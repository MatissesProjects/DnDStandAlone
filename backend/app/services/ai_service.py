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
        
        # Try Gemini first
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
                response = self.client.models.generate_content(
                    model=settings.GEMINI_MODEL,
                    contents=prompt
                )
                text = response.text
                print(f"Gemini success! Raw response length: {len(text)}")
                
                if "```json" in text:
                    text = text.split("```json")[1].split("```")[0]
                elif "```" in text:
                    text = text.split("```")[1].split("```")[0]
                
                return json.loads(text.strip())
            except Exception as e:
                print(f"Gemini generation failed, falling back: {str(e)}")
        
        # Fallback to Ollama
        ollama_result = await self._ollama_generate_enemy(context)
        if ollama_result:
            return ollama_result
            
        return {
            "name": "Generation Error",
            "stats": {"hp": 0, "ac": 0},
            "backstory": "Failed to generate entity using both Gemini and Ollama. Check backend logs for details."
        }

    async def generate_lore(self, location: models.Location, history: List[models.HistoryLog]) -> str:
        context = self._format_context(location, history)
        prompt = f"""
        You are a D&D Dungeon Master's assistant. Based on the following context, provide a brief piece of flavorful lore or a hidden detail the players might discover.
        
        {context}
        
        Keep it under 3 sentences and highly atmospheric.
        """
        
        # Try Gemini first
        if self.client:
            try:
                print(f"Attempting Gemini lore generation ({settings.GEMINI_MODEL})...")
                response = self.client.models.generate_content(
                    model=settings.GEMINI_MODEL,
                    contents=prompt
                )
                print("Gemini lore success!")
                return response.text.strip()
            except Exception as e:
                print(f"Gemini lore failed, falling back: {str(e)}")

        # Fallback to Ollama
        try:
            print(f"Attempting Ollama lore generation with {settings.OLLAMA_MODEL}...")
            response = await self.ollama_client.chat(model=settings.OLLAMA_MODEL, messages=[
                {'role': 'user', 'content': prompt},
            ])
            print("Ollama lore success!")
            return response['message']['content'].strip()
        except Exception as e:
            print(f"Ollama lore failed: {str(e)}")
            return "The shadows remain silent. (Both AI providers failed to respond)"

ai_service = GeminiService()
