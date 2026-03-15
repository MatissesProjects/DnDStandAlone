from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import logging
import uuid
import os
import shutil
import traceback

from app.db.database import get_db
from app.models import models
from app.api import auth
from app.crud import crud
from app.services.ai_service import ai_service

router = APIRouter(tags=["ai"])
logger = logging.getLogger(__name__)

@router.post("/upload-audio")
async def upload_audio(
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "gm":
        raise HTTPException(status_code=403, detail="Only GMs can upload audio")
    
    try:
        filename = file.filename or "unnamed_audio.mp3"
        file_extension = os.path.splitext(filename)[1]
        file_name = f"{uuid.uuid4().hex}{file_extension}"
        file_path = os.path.join("uploads", "audio", file_name)
        
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        logger.info(f"Audio uploaded successfully: {file_name}")
        return {"url": f"/uploads/audio/{file_name}"}
    except Exception as e:
        error_detail = traceback.format_exc()
        logger.error(f"Upload Audio Error: {e}\n{error_detail}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/campaigns/{campaign_id}/generate-enemy")
async def generate_enemy(
    campaign_id: int,
    location_id: int = Query(...),
    payload: Dict[Any, Any] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "gm":
        raise HTTPException(status_code=403, detail="Only GMs can generate enemies")
    
    try:
        location = db.query(models.Location).filter(models.Location.id == location_id).first()
        if not location:
            location = models.Location(name="Unknown Wilds", description="A mysterious uncharted area", danger_level=3)
            
        history = crud.get_history(db, campaign_id, limit=5)
        enemy_data = await ai_service.generate_enemy(location, history)
        return enemy_data
    except Exception as e:
        logger.error(f"Generate Enemy Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/campaigns/{campaign_id}/generate-lore")
async def generate_lore(
    campaign_id: int,
    location_id: int = Query(...),
    payload: Dict[Any, Any] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "gm":
        raise HTTPException(status_code=403, detail="Only GMs can generate lore")
    
    try:
        location = db.query(models.Location).filter(models.Location.id == location_id).first()
        if not location:
            location = models.Location(name="Unknown Wilds", description="A mysterious uncharted area", danger_level=3)
            
        history = crud.get_history(db, campaign_id, limit=5)
        
        user_context = ""
        if payload and "context" in payload:
            user_context = payload["context"]
            
        lore_text = await ai_service.generate_lore(location, history, user_context=user_context)
        return {"lore": lore_text}
    except Exception as e:
        logger.error(f"Generate Lore Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/campaigns/{campaign_id}/generate-loot")
async def generate_loot(
    campaign_id: int,
    location_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "gm":
        raise HTTPException(status_code=403, detail="Only GMs can generate loot")
    
    try:
        location = db.query(models.Location).filter(models.Location.id == location_id).first()
        if not location:
            location = models.Location(name="Unknown Wilds", description="A mysterious uncharted area", danger_level=3)
            
        history = crud.get_history(db, campaign_id, limit=10)
        loot_text = await ai_service.generate_loot(location, history)
        return {"loot": loot_text}
    except Exception as e:
        logger.error(f"Generate Loot Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
