from sqlalchemy import Column, Integer, String, Text, ForeignKey, JSON, DateTime, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    discord_id = Column(String, unique=True, index=True)
    username = Column(String)
    role = Column(String, default="player") # "gm" or "player"
    avatar_url = Column(String, nullable=True)
    bio = Column(Text, nullable=True)
    class_name = Column(String, nullable=True)
    level = Column(Integer, default=1)
    stats = Column(JSON, nullable=True) # Structured stats (HP, AC, Str, Dex, etc.)
    inventory = Column(Text, nullable=True) # Simple text-based inventory for now

class Campaign(Base):
    __tablename__ = "campaigns"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    room_id = Column(String, unique=True, index=True) # Unique join code
    initiative_data = Column(JSON, nullable=True) # Store initiative list
    gm_id = Column(Integer, ForeignKey("users.id"))
    gm = relationship("User")

class Location(Base):
    __tablename__ = "locations"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(Text)
    danger_level = Column(Integer, default=1)
    canvas_state = Column(JSON, nullable=True) # Store Excalidraw elements per location
    x = Column(Integer, default=0)
    y = Column(Integer, default=0)
    zoom = Column(Integer, default=1)
    ambient_audio = Column(String, nullable=True) # URL to audio file
    map_scale = Column(Integer, default=5) # 5ft per "unit"
    is_fog_active = Column(Boolean, default=False)
    fog_data = Column(JSON, nullable=True) # Store revealed areas
    campaign_id = Column(Integer, ForeignKey("campaigns.id"))
    campaign = relationship("Campaign")

class Entity(Base):
    __tablename__ = "entities"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    stats = Column(JSON) # Store stats as JSON
    backstory = Column(Text)
    notes = Column(Text, nullable=True) # GM specific notes
    location_id = Column(Integer, ForeignKey("locations.id"))
    location = relationship("Location")

class HistoryLog(Base):
    __tablename__ = "history_logs"
    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String) # "dice_roll", "lore_update", etc.
    content = Column(Text)
    is_private = Column(Boolean, default=False)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"))
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    campaign = relationship("Campaign")

class Handout(Base):
    __tablename__ = "handouts"
    id = Column(Integer, primary_key=True, index=True)
    type = Column(String) # "text" or "image"
    title = Column(String)
    content = Column(Text)
    x = Column(Integer, default=100)
    y = Column(Integer, default=100)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"))
    campaign = relationship("Campaign")
