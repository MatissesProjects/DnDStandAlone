import json
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status, Query
from typing import Optional, List
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.db.database import engine, get_db, Base
from app.services.websocket_manager import manager
from app.models import models
from app.api import auth
from app.schemas import schemas, history as history_schemas
from app.crud import crud
from app.services.ai_service import ai_service

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create database tables
try:
    models.Base.metadata.create_all(bind=engine)
    logger.info("Database tables verified/created successfully")
except Exception as e:
    logger.error(f"Error connecting to database: {e}")

app = FastAPI()

# Robust CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

app.include_router(auth.router)

@app.get("/health")
async def health_check(db: Session = Depends(get_db)):
    return {"status": "ok", "db_connected": True}

@app.get("/test-db")
def test_db(db: Session = Depends(get_db)):
    try:
        count = db.query(models.User).count()
        return {"status": "ok", "user_count": count}
    except Exception as e:
        logger.error(f"DB Test Error: {e}")
        return {"status": "error", "message": str(e)}

# Campaign Endpoints
@app.get("/campaigns", response_model=List[schemas.Campaign])
def read_campaigns(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    try:
        campaigns = crud.get_campaigns(db, skip=skip, limit=limit)
        return campaigns
    except Exception as e:
        logger.error(f"Error reading campaigns: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/campaigns", response_model=schemas.Campaign)
def create_campaign(
    campaign: schemas.CampaignCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "gm":
        raise HTTPException(status_code=403, detail="Only GMs can create campaigns")
    try:
        return crud.create_campaign(db=db, campaign=campaign, gm_id=current_user.id)
    except Exception as e:
        logger.error(f"Error creating campaign: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/campaigns/{campaign_id}/canvas", response_model=schemas.Campaign)
def update_campaign_canvas(
    campaign_id: int,
    update: schemas.CampaignUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "gm":
        raise HTTPException(status_code=403, detail="Only GMs can save canvas state")
    return crud.update_campaign_canvas(db=db, campaign_id=campaign_id, canvas_state=update.canvas_state)

@app.get("/campaigns/join/{room_id}", response_model=schemas.Campaign)
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

@app.post("/campaigns/{campaign_id}/history", response_model=history_schemas.HistoryLog)
def add_campaign_history(
    campaign_id: int,
    log: history_schemas.HistoryLogCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "gm":
        raise HTTPException(status_code=403, detail="Only GMs can record history")
    return crud.create_history_log(db=db, log=log)

# Location Endpoints
@app.get("/campaigns/{campaign_id}/locations", response_model=List[schemas.Location])
def read_locations(campaign_id: int, db: Session = Depends(get_db)):
    return crud.get_locations(db, campaign_id=campaign_id)

@app.post("/locations", response_model=schemas.Location)
def create_location(
    location: schemas.LocationCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "gm":
        raise HTTPException(status_code=403, detail="Only GMs can create locations")
    return crud.create_location(db=db, location=location)

# AI Endpoints
@app.post("/campaigns/{campaign_id}/generate-enemy")
async def generate_enemy(
    campaign_id: int,
    location_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "gm":
        raise HTTPException(status_code=403, detail="Only GMs can generate enemies")
    
    location = db.query(models.Location).filter(models.Location.id == location_id).first()
    if not location:
        location = models.Location(name="Unknown Wilds", description="A mysterious uncharted area", danger_level=3)
        
    history = crud.get_history(db, campaign_id, limit=5)
    enemy_data = await ai_service.generate_enemy(location, history)
    return enemy_data

@app.post("/campaigns/{campaign_id}/generate-lore")
async def generate_lore(
    campaign_id: int,
    location_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "gm":
        raise HTTPException(status_code=403, detail="Only GMs can generate lore")
    
    location = db.query(models.Location).filter(models.Location.id == location_id).first()
    if not location:
        location = models.Location(name="Unknown Wilds", description="A mysterious uncharted area", danger_level=3)
        
    history = crud.get_history(db, campaign_id, limit=5)
    lore_text = await ai_service.generate_lore(location, history)
    
    crud.create_history_log(db, schemas.HistoryLogCreate(
        campaign_id=campaign_id,
        event_type="lore_update",
        content=f"AI Lore: {lore_text}"
    ))
    
    return {"lore": lore_text}

@app.websocket("/ws/{room_id}/{client_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, client_id: str, role: str = "player", username: str = "Anonymous"):
    await manager.connect(websocket, client_id, room_id, role, username)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message_json = json.loads(data)
                if message_json.get("type") == "request_roll" and role == "gm":
                    target_id = message_json.get("target_id")
                    if target_id:
                        await manager.send_personal_message(data, target_id)
                    continue

                if message_json.get("isSubtle") is True:
                    await manager.broadcast(data, room_id, role_limit="gm")
                    if role != "gm":
                        await manager.send_personal_message(data, client_id)
                else:
                    await manager.broadcast(data, room_id)
            except json.JSONDecodeError:
                await manager.broadcast(data, room_id)
    except WebSocketDisconnect:
        manager.disconnect(client_id, room_id)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
