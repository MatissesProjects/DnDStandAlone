from sqlalchemy.orm import Session
from app.models import models
from app.schemas import schemas

import uuid
import string
import random

def generate_room_id(length=6):
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))

# Campaign CRUD
def get_campaign(db: Session, campaign_id: int):
    return db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()

def get_campaign_by_room(db: Session, room_id: str):
    return db.query(models.Campaign).filter(models.Campaign.room_id == room_id).first()

def get_campaigns(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Campaign).offset(skip).limit(limit).all()

def get_user_campaigns(db: Session, user_id: int):
    return db.query(models.Campaign).filter(models.Campaign.gm_id == user_id).all()

def update_user(db: Session, user_id: int, user_update: schemas.UserUpdate):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if db_user:
        update_data = user_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_user, key, value)
        db.commit()
        db.refresh(db_user)
    return db_user

def create_campaign(db: Session, campaign: schemas.CampaignCreate, gm_id: int):
    room_id = generate_room_id()
    # Ensure uniqueness
    while db.query(models.Campaign).filter(models.Campaign.room_id == room_id).first():
        room_id = generate_room_id()
        
    db_campaign = models.Campaign(**campaign.model_dump(), gm_id=gm_id, room_id=room_id)
    db.add(db_campaign)
    db.commit()
    db.refresh(db_campaign)
    return db_campaign

def update_campaign_canvas(db: Session, campaign_id: int, canvas_state: dict):
    db_campaign = db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()
    if db_campaign:
        db_campaign.canvas_state = canvas_state
        db.commit()
        db.refresh(db_campaign)
    return db_campaign

# Location CRUD
def get_locations(db: Session, campaign_id: int):
    return db.query(models.Location).filter(models.Location.campaign_id == campaign_id).all()

def create_location(db: Session, location: schemas.LocationCreate):
    db_location = models.Location(**location.model_dump())
    db.add(db_location)
    db.commit()
    db.refresh(db_location)
    return db_location

# Entity CRUD
def get_entities(db: Session, location_id: int):
    return db.query(models.Entity).filter(models.Entity.location_id == location_id).all()

def create_entity(db: Session, entity: schemas.EntityCreate):
    db_entity = models.Entity(**entity.model_dump())
    db.add(db_entity)
    db.commit()
    db.refresh(db_entity)
    return db_entity

def update_entity(db: Session, entity_id: int, entity_update: dict):
    db_entity = db.query(models.Entity).filter(models.Entity.id == entity_id).first()
    if db_entity:
        for key, value in entity_update.items():
            setattr(db_entity, key, value)
        db.commit()
        db.refresh(db_entity)
    return db_entity

# History CRUD
def get_history(db: Session, campaign_id: int, limit: int = 10):
    return db.query(models.HistoryLog)\
        .filter(models.HistoryLog.campaign_id == campaign_id)\
        .order_by(models.HistoryLog.timestamp.desc())\
        .limit(limit).all()

def create_history_log(db: Session, log: schemas.HistoryLogCreate):
    db_log = models.HistoryLog(**log.model_dump())
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log
