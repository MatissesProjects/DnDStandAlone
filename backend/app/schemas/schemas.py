from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime

# User Schemas
class UserBase(BaseModel):
    discord_id: str
    username: str
    role: str

class User(UserBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

# Campaign Schemas
class CampaignBase(BaseModel):
    name: str

class CampaignCreate(CampaignBase):
    pass

class Campaign(CampaignBase):
    id: int
    gm_id: int
    room_id: str
    model_config = ConfigDict(from_attributes=True)

# Location Schemas
class LocationBase(BaseModel):
    name: str
    description: Optional[str] = None
    danger_level: int = 1

class LocationCreate(LocationBase):
    campaign_id: int

class Location(LocationBase):
    id: int
    campaign_id: int
    model_config = ConfigDict(from_attributes=True)

# Entity Schemas
class EntityBase(BaseModel):
    name: str
    stats: Optional[Dict[str, Any]] = None
    backstory: Optional[str] = None

class EntityCreate(EntityBase):
    location_id: int

class Entity(EntityBase):
    id: int
    location_id: int
    model_config = ConfigDict(from_attributes=True)

# HistoryLog Schemas
class HistoryLogBase(BaseModel):
    event_type: str
    content: str

class HistoryLogCreate(HistoryLogBase):
    campaign_id: int

class HistoryLog(HistoryLogBase):
    id: int
    campaign_id: int
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)
