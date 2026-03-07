from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Default to SQLite for easy local development without Docker
    DATABASE_URL: str = "sqlite:///./vtt.db"
    
    # Auth
    SECRET_KEY: str = "your-secret-key-change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 1 week
    
    # Discord OAuth2
    # Get these from https://discord.com/developers/applications
    DISCORD_CLIENT_ID: str = ""
    DISCORD_CLIENT_SECRET: str = ""
    DISCORD_REDIRECT_URI: str = "http://localhost:8000/auth/callback"
    
    # AI
    GEMINI_API_KEY: Optional[str] = None

    class Config:
        env_file = ".env"

settings = Settings()
