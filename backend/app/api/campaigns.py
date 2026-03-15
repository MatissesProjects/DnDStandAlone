from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import logging

from app.db.database import get_db
from app.models import models
from app.schemas import schemas
from app.crud import crud
from app.api import auth
from app.services.ai_service import ai_service

router = APIRouter(prefix="/campaigns", tags=["campaigns"])
logger = logging.getLogger(__name__)

@router.get("", response_model=List[schemas.Campaign])
def read_campaigns(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    try:
        return crud.get_campaigns(db, skip=skip, limit=limit)
    except Exception as e:
        logger.error(f"Error reading campaigns: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/active", response_model=List[schemas.Campaign])
def get_active_campaigns(db: Session = Depends(get_db)):
    """Retrieve active campaigns for users to join."""
    return db.query(models.Campaign).order_by(models.Campaign.id.desc()).limit(10).all()

@router.post("", response_model=schemas.Campaign)
def create_campaign(
    campaign: schemas.CampaignCreate, 
    elevate_to_gm: bool = True,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Ensure user is in the current session
    if current_user not in db:
        current_user = db.merge(current_user)
        
    # Elevate user to GM if they are creating a campaign
    if elevate_to_gm and current_user.role != "gm":
        current_user.role = "gm"
        db.commit()
        db.refresh(current_user)
        logger.info(f"User {current_user.username} elevated to GM for new campaign")
    
    if not elevate_to_gm and current_user.role != "gm":
        raise HTTPException(status_code=403, detail="Only GMs can create campaigns")
        
    try:
        return crud.create_campaign(db=db, campaign=campaign, gm_id=current_user.id)
    except Exception as e:
        logger.error(f"Error creating campaign: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{campaign_id}")
def delete_campaign(
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "gm":
        raise HTTPException(status_code=403, detail="Only GMs can delete campaigns")
    if crud.delete_campaign(db=db, campaign_id=campaign_id, gm_id=current_user.id):
        return {"status": "ok"}
    raise HTTPException(status_code=404, detail="Campaign not found")

@router.get("/join/{room_id}", response_model=schemas.Campaign)
def join_campaign(room_id: str, db: Session = Depends(get_db)):
    try:
        campaign = crud.get_campaign_by_room(db, room_id=room_id)
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        return campaign
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error joining campaign: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{campaign_id}/history", response_model=List[schemas.HistoryLog])
def read_campaign_history(
    campaign_id: int,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    include_private = current_user.role == "gm"
    return crud.get_history(db, campaign_id=campaign_id, limit=limit, include_private=include_private)

@router.post("/{campaign_id}/history", response_model=schemas.HistoryLog)
def add_campaign_history(
    campaign_id: int,
    log: schemas.HistoryLogCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "gm" and log.event_type != "dice_roll":
        raise HTTPException(status_code=403, detail="Only GMs can record general history")
    return crud.create_history_log(db=db, log=log)

@router.delete("/{campaign_id}/history/{log_id}")
def delete_campaign_history(
    campaign_id: int,
    log_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if crud.delete_history_log(db=db, log_id=log_id):
        return {"status": "ok"}
    raise HTTPException(status_code=404, detail="Log not found")

@router.get("/{campaign_id}/summarize")
async def summarize_campaign(
    campaign_id: int,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    history = crud.get_history(db, campaign_id, limit=limit)
    locations = crud.get_locations(db, campaign_id)
    
    entities = []
    for loc in locations:
        entities.extend(crud.get_entities(db, loc.id))
    
    players = db.query(models.User).filter(models.User.role == "player").all()
    
    summary = await ai_service.summarize_session(history, locations, entities, players)
    return {"summary": summary}

@router.get("/{campaign_id}/handouts", response_model=List[schemas.Handout])
def read_handouts(campaign_id: int, db: Session = Depends(get_db)):
    return crud.get_handouts(db, campaign_id=campaign_id)

@router.get("/{campaign_id}/locations", response_model=List[schemas.Location])
def read_locations(campaign_id: int, db: Session = Depends(get_db)):
    return crud.get_locations(db, campaign_id=campaign_id)
