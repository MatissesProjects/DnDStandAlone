from sqlalchemy.orm import Session
import models
import schemas

# Campaign CRUD
def get_campaign(db: Session, campaign_id: int):
    return db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()

def get_campaigns(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Campaign).offset(skip).limit(limit).all()

def create_campaign(db: Session, campaign: schemas.CampaignCreate, gm_id: int):
    db_campaign = models.Campaign(**campaign.dict(), gm_id=gm_id)
    db.add(db_campaign)
    db.commit()
    db.refresh(db_campaign)
    return db_campaign

# Location CRUD
def get_locations(db: Session, campaign_id: int):
    return db.query(models.Location).filter(models.Location.campaign_id == campaign_id).all()

def create_location(db: Session, location: schemas.LocationCreate):
    db_location = models.Location(**location.dict())
    db.add(db_location)
    db.commit()
    db.refresh(db_location)
    return db_location

# Entity CRUD
def get_entities(db: Session, location_id: int):
    return db.query(models.Entity).filter(models.Entity.location_id == location_id).all()

def create_entity(db: Session, entity: schemas.EntityCreate):
    db_entity = models.Entity(**entity.dict())
    db.add(db_entity)
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
    db_log = models.HistoryLog(**log.dict())
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log
