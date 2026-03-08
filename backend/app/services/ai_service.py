import google.generativeai as genai
import json
import ollama
from app.core.config import settings
from typing import List, Dict, Any
from app.models import models

class GeminiService:
    def __init__(self):
        if settings.GEMINI_API_KEY:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            self.model = genai.GenerativeModel(settings.GEMINI_MODEL)
        else:
            self.model = None
        
        self.ollama_client = ollama.AsyncClient(host=settings.OLLAMA_HOST)

    def _format_context(self, location: models.Location, history: List[models.HistoryLog]) -> str:
        context = f"Current Location: {location.name} (Danger Level: {location.danger_level})\n"
        context += f"Location Description: {location.description}\n\n"
        context += "Recent Events:\n"
        for log in reversed(history):
            context += f"- {log.content}\n"
        return context

    async def _ollama_generate_enemy(self, context: str) -> Dict[str, Any]:
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
            return json.loads(response['message']['content'])
        except Exception as e:
            print(f"Ollama generation failed: {e}")
            return None

    async def generate_enemy(self, location: models.Location, history: List[models.HistoryLog]) -> Dict[str, Any]:
        context = self._format_context(location, history)
        
        # Try Gemini first
        if self.model:
            try:
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
                response = self.model.generate_content(prompt)
                text = response.text
                if "```json" in text:
                    text = text.split("```json")[1].split("```")[0]
                elif "```" in text:
                    text = text.split("```")[1].split("```")[0]
                
                return json.loads(text.strip())
            except Exception as e:
                print(f"Gemini generation failed, falling back to Ollama: {e}")
        
        # Fallback to Ollama
        ollama_result = await self._ollama_generate_enemy(context)
        if ollama_result:
            return ollama_result
            
        return {
            "name": "Generation Error",
            "stats": {"hp": 0, "ac": 0},
            "backstory": "Failed to generate entity using both Gemini and Ollama."
        }

    async def generate_lore(self, location: models.Location, history: List[models.HistoryLog]) -> str:
        context = self._format_context(location, history)
        prompt = f"""
        You are a D&D Dungeon Master's assistant. Based on the following context, provide a brief piece of flavorful lore or a hidden detail the players might discover.
        
        {context}
        
        Keep it under 3 sentences and highly atmospheric.
        """
        
        # Try Gemini first
        if self.model:
            try:
                response = self.model.generate_content(prompt)
                return response.text.strip()
            except Exception as e:
                print(f"Gemini lore generation failed, falling back to Ollama: {e}")

        # Fallback to Ollama
        try:
            response = await self.ollama_client.chat(model=settings.OLLAMA_MODEL, messages=[
                {'role': 'user', 'content': prompt},
            ])
            return response['message']['content'].strip()
        except Exception as e:
            print(f"Ollama lore generation failed: {e}")
            return "The shadows remain silent. (AI generation failed)"

ai_service = GeminiService()
