from google import genai
import json
import ollama
from app.core.config import settings
from typing import List, Dict, Any
from app.models import models

class GeminiService:
    def __init__(self):
        print(f"Initializing AI Service. Gemini Key present: {bool(settings.GEMINI_API_KEY)}")
        if settings.GEMINI_API_KEY:
            self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
            print(f"Gemini configured with model: {settings.GEMINI_MODEL}")
        else:
            self.client = None
            print("Gemini NOT configured (missing API key)")
        
        self.ollama_client = ollama.AsyncClient(host=settings.OLLAMA_HOST)
        print(f"Ollama client initialized for host: {settings.OLLAMA_HOST} with model: {settings.OLLAMA_MODEL}")

    def _format_context(self, location: models.Location, history: List[models.HistoryLog]) -> str:
        context = f"Current Location: {location.name} (Danger Level: {location.danger_level})\n"
        context += f"Location Description: {location.description}\n\n"
        context += "Recent Events:\n"
        for log in reversed(history):
            context += f"- {log.content}\n"
        return context

    async def _ollama_generate_enemy(self, context: str) -> Dict[str, Any]:
        print(f"Attempting Ollama generation with model {settings.OLLAMA_MODEL}...")
        prompt = f"""
        You are a D&D Dungeon Master's assistant. Based on the following context, generate a unique enemy or NPC.
        
        {context}
        
        Output MUST be a valid JSON object with the following structure:
        {{
            "name": "Name of the entity",
            "stats": {{
                "hp": number,
                "ac": number,
                "str": number,
                "dex": number,
                "con": number,
                "int": number,
                "wis": number,
                "cha": number,
                "actions": ["action 1", "action 2"]
            }},
            "backstory": "A brief 2-sentence description of how they fit into the current scene."
        }}
        """
        try:
            response = await self.ollama_client.chat(model=settings.OLLAMA_MODEL, messages=[
                {'role': 'user', 'content': prompt},
            ], format='json')
            content = response['message']['content']
            print(f"Ollama success! Response length: {len(content)}")
            return json.loads(content)
        except Exception as e:
            print(f"Ollama generation failed CRITICALLY: {str(e)}")
            return None

    async def generate_enemy(self, location: models.Location, history: List[models.HistoryLog]) -> Dict[str, Any]:
        context = self._format_context(location, history)
        if self.client:
            try:
                print(f"Attempting Gemini generation ({settings.GEMINI_MODEL})...")
                prompt = f"""
                You are a D&D Dungeon Master's assistant. Based on the following context, generate a unique enemy or NPC.
                
                {context}
                
                Output MUST be a valid JSON object with the following structure:
                {{
                    "name": "Name of the entity",
                    "stats": {{
                        "hp": number,
                        "ac": number,
                        "str": number,
                        "dex": number,
                        "con": number,
                        "int": number,
                        "wis": number,
                        "cha": number,
                        "actions": ["action 1", "action 2"]
                    }},
                    "backstory": "A brief 2-sentence description of how they fit into the current scene."
                }}
                """
                response = self.client.models.generate_content(model=settings.GEMINI_MODEL, contents=prompt)
                text = response.text
                if "```json" in text: text = text.split("```json")[1].split("```")[0]
                elif "```" in text: text = text.split("```")[1].split("```")[0]
                return json.loads(text.strip())
            except Exception as e: print(f"Gemini failed: {e}")
        
        ollama_result = await self._ollama_generate_enemy(context)
        if ollama_result: return ollama_result
        return {"name": "Error", "stats": {"hp": 0, "ac": 0}, "backstory": "Failed AI generation."}

    async def generate_lore(self, location: models.Location, history: List[models.HistoryLog], user_context: str = "") -> str:
        context = self._format_context(location, history)
        prompt = f"""
        You are a D&D DM assistant. Based on the current location, recent history, 
        and any specific context provided by the GM, generate or augment a piece of "Whispered Lore".
        
        The lore should be atmospheric, descriptive, and narratively consistent.
        
        Location: {location.name}
        Description: {location.description}
        
        Recent History:
        {context}
        
        GM's Draft/Context:
        "{user_context}"
        
        If the GM provided a draft, refine and expand upon it. If not, generate something new.
        Keep the output concise (1-3 paragraphs) and focus on sensory details or secrets.
        """
        if self.client:
            try:
                response = self.client.models.generate_content(model=settings.GEMINI_MODEL, contents=prompt)
                return response.text.strip()
            except Exception as e: print(f"Gemini failed: {e}")
        try:
            response = await self.ollama_client.chat(model=settings.OLLAMA_MODEL, messages=[{'role': 'user', 'content': prompt}])
            return response['message']['content'].strip()
        except Exception as e: return "The shadows remain silent."

    async def generate_loot(self, location: models.Location, history: List[models.HistoryLog]) -> str:
        context = self._format_context(location, history)
        prompt = f"""
        You are a D&D DM assistant. Based on the current location and recent events, 
        generate a thematic loot table or a specific magical item found.
        Make it narratively consistent (e.g. aquatic loot in a flooded temple).
        
        Context:
        {context}
        
        Provide a concise description of the loot found.
        """
        if self.client:
            try:
                response = self.client.models.generate_content(model=settings.GEMINI_MODEL, contents=prompt)
                return response.text.strip()
            except Exception as e: print(f"Gemini loot failed: {e}")
        try:
            response = await self.ollama_client.chat(model=settings.OLLAMA_MODEL, messages=[{'role': 'user', 'content': prompt}])
            return response['message']['content'].strip()
        except Exception as e: return "You find nothing but dust and echoes."

    async def summarize_session(self, history: List[models.HistoryLog], locations: List[models.Location], entities: List[models.Entity], players: List[models.User]) -> str:
        if not history:
            return "No chronicle entries found to summarize."
            
        logs = "\n".join([f"[{log.event_type}] {log.content}" for log in reversed(history)])
        
        loc_str = "\n".join([f"- {l.name}: {l.description}" for l in locations])
        ent_str = "\n".join([f"- {e.name}: {e.backstory}" for e in entities])
        plr_str = "\n".join([f"- {p.username} ({p.class_name}, Lvl {p.level})" for p in players])

        prompt = f"""
        You are a bard recounting the epic tales of a D&D session. 
        Based on the following context, provide a concise, immersive summary of the current state of the world and recent events.
        
        ACTIVE LOCATIONS:
        {loc_str}
        
        MANIFESTED ENTITIES (NPCs/Enemies):
        {ent_str}
        
        THE ADVENTURERS:
        {plr_str}

        CHRONICLE LOGS (Recent Events):
        {logs}

        Focus on key narrative points, major victories, and mysterious omens.
        Integrate the locations and NPCs naturally into the retelling.
        Keep it under 5 paragraphs and maintain a high-fantasy tone.
        """
        
        if self.client:
            try:
                print(f"Attempting Gemini summary...")
                response = self.client.models.generate_content(model=settings.GEMINI_MODEL, contents=prompt)
                return response.text.strip()
            except Exception as e:
                print(f"Gemini summary failed: {e}")

        # Fallback to Ollama
        try:
            print(f"Attempting Ollama summary...")
            response = await self.ollama_client.chat(model=settings.OLLAMA_MODEL, messages=[
                {'role': 'user', 'content': prompt},
            ])
            return response['message']['content'].strip()
        except Exception as e:
            print(f"Ollama summary failed: {str(e)}")
            return "The archives are incomplete. (Summary generation failed)"

ai_service = GeminiService()
