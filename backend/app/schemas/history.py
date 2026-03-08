from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class HistoryLogBase(BaseModel):
    event_type: str
    content: str
    campaign_id: int

class HistoryLogCreate(HistoryLogBase):
    pass

class HistoryLog(HistoryLogBase):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True
