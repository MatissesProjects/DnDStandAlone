from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime

# User Schemas
class UserBase(BaseModel):
    discord_id: str
    username: str
    role: str = "player"
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    class_name: Optional[str] = None
    level: Optional[int] = 1
    inventory: Optional[str] = None

class UserUpdate(BaseModel):
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    class_name: Optional[str] = None
    level: Optional[int] = None
    inventory: Optional[str] = None


class User(UserBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

# Campaign Schemas
class CampaignBase(BaseModel):
    name: str

class CampaignCreate(CampaignBase):
    pass

class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    initiative_data: Optional[Dict[str, Any]] = None

class Campaign(CampaignBase):
    id: int
    gm_id: int
    room_id: str
    initiative_data: Optional[Dict[str, Any]] = None
    model_config = ConfigDict(from_attributes=True)

# Location Schemas
class LocationBase(BaseModel):
    name: str
    description: Optional[str] = None
    danger_level: int = 1
    canvas_state: Optional[Dict[str, Any]] = None
    x: Optional[int] = 0
    y: Optional[int] = 0
    zoom: Optional[float] = 1.0
    ambient_audio: Optional[str] = None
    map_scale: Optional[int] = 5
    is_fog_active: Optional[bool] = False
    fog_data: Optional[Dict[str, Any]] = None

class LocationCreate(LocationBase):
    campaign_id: int

class LocationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    danger_level: Optional[int] = None
    canvas_state: Optional[Dict[str, Any]] = None
    x: Optional[int] = None
    y: Optional[int] = None
    zoom: Optional[float] = None
    ambient_audio: Optional[str] = None
    is_fog_active: Optional[bool] = None
    fog_data: Optional[Dict[str, Any]] = None

class Location(LocationBase):
    id: int
    campaign_id: int
    model_config = ConfigDict(from_attributes=True)

# Entity Schemas
class EntityBase(BaseModel):
    name: str
    stats: Optional[Dict[str, Any]] = None
    backstory: Optional[str] = None
    notes: Optional[str] = None

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
    is_private: bool = False

class HistoryLogCreate(HistoryLogBase):
    campaign_id: int

class HistoryLog(HistoryLogBase):
    id: int
    campaign_id: int
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)

# Handout Schemas
class HandoutBase(BaseModel):
    type: str
    title: str
    content: str
    x: int = 100
    y: int = 100

class HandoutCreate(HandoutBase):
    campaign_id: int

class HandoutUpdate(BaseModel):
    x: Optional[int] = None
    y: Optional[int] = None
    title: Optional[str] = None
    content: Optional[str] = None

class Handout(HandoutBase):
    id: int
    campaign_id: int
    model_config = ConfigDict(from_attributes=True)
