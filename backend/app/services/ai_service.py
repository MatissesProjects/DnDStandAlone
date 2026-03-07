import google.generativeai as genai
import json
from app.core.config import settings
from typing import List, Dict, Any
from app.models import models

class GeminiService:
    def __init__(self):
        if settings.GEMINI_API_KEY:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            self.model = genai.GenerativeModel('gemini-1.5-flash')
        else:
            self.model = None

    def _format_context(self, location: models.Location, history: List[models.HistoryLog]) -> str:
        context = f"Current Location: {location.name} (Danger Level: {location.danger_level})\n"
        context += f"Location Description: {location.description}\n\n"
        context += "Recent Events:\n"
        for log in reversed(history):
            context += f"- {log.content}\n"
        return context

    async def generate_enemy(self, location: models.Location, history: List[models.HistoryLog]) -> Dict[str, Any]:
        if not self.model:
            return {"error": "Gemini API key not configured"}

        context = self._format_context(location, history)
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
        try:
            text = response.text
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[1].split("```")[0]
            
            return json.loads(text.strip())
        except Exception as e:
            return {
                "name": "Generation Error",
                "stats": {"hp": 0, "ac": 0},
                "backstory": f"Failed to parse AI response: {str(e)}"
            }

    async def generate_lore(self, location: models.Location, history: List[models.HistoryLog]) -> str:
        if not self.model:
            return "Gemini API key not configured"

        context = self._format_context(location, history)
        prompt = f"""
        You are a D&D Dungeon Master's assistant. Based on the following context, provide a brief piece of flavorful lore or a hidden detail the players might discover.
        
        {context}
        
        Keep it under 3 sentences and highly atmospheric.
        """
        
        response = self.model.generate_content(prompt)
        return response.text.strip()

ai_service = GeminiService()
