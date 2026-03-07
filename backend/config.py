from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Default to SQLite for easy local development without Docker
    DATABASE_URL: str = "sqlite:///./vtt.db"
    
    # Discord OAuth2
    DISCORD_CLIENT_ID: Optional[str] = None
    DISCORD_CLIENT_SECRET: Optional[str] = None
    DISCORD_REDIRECT_URI: str = "http://localhost:8000/auth/callback"
    
    # AI
    GEMINI_API_KEY: Optional[str] = None

    class Config:
        env_file = ".env"

settings = Settings()
