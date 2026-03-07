from sqlalchemy import Column, Integer, String, Text, ForeignKey, JSON, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    discord_id = Column(String, unique=True, index=True)
    username = Column(String)
    role = Column(String, default="player") # "gm" or "player"

class Campaign(Base):
    __tablename__ = "campaigns"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    room_id = Column(String, unique=True, index=True) # Unique join code
    gm_id = Column(Integer, ForeignKey("users.id"))
    gm = relationship("User")

class Location(Base):
    __tablename__ = "locations"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(Text)
    danger_level = Column(Integer, default=1)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"))
    campaign = relationship("Campaign")

class Entity(Base):
    __tablename__ = "entities"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    stats = Column(JSON) # Store stats as JSON
    backstory = Column(Text)
    location_id = Column(Integer, ForeignKey("locations.id"))
    location = relationship("Location")

class HistoryLog(Base):
    __tablename__ = "history_logs"
    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String) # "dice_roll", "lore_update", etc.
    content = Column(Text)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"))
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    campaign = relationship("Campaign")
