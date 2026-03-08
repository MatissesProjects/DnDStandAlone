import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status, Query
from typing import Optional, List
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.db.database import engine, get_db, Base
from app.services.websocket_manager import manager
from app.models import models
from app.api import auth
from app.schemas import schemas
from app.crud import crud
from app.services.ai_service import ai_service

# Create database tables
try:
    models.Base.metadata.create_all(bind=engine)
    print("Database tables created successfully")
except Exception as e:
    print(f"Error connecting to database: {e}")

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)

@app.get("/health")
async def health_check(db: Session = Depends(get_db)):
    return {"status": "ok", "db_connected": True}

# Campaign Endpoints
@app.get("/campaigns", response_model=List[schemas.Campaign])
def read_campaigns(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    campaigns = crud.get_campaigns(db, skip=skip, limit=limit)
    return campaigns

@app.post("/campaigns", response_model=schemas.Campaign)
def create_campaign(
    campaign: schemas.CampaignCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "gm":
        raise HTTPException(status_code=403, detail="Only GMs can create campaigns")
    return crud.create_campaign(db=db, campaign=campaign, gm_id=current_user.id)

@app.get("/campaigns/join/{room_id}", response_model=schemas.Campaign)
def join_campaign(room_id: str, db: Session = Depends(get_db)):
    campaign = crud.get_campaign_by_room(db, room_id=room_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign

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
        # Fallback for testing if no location exists yet
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
        # Fallback for testing
        location = models.Location(name="Unknown Wilds", description="A mysterious uncharted area", danger_level=3)
        
    history = crud.get_history(db, campaign_id, limit=5)
    lore_text = await ai_service.generate_lore(location, history)
    
    # Save to history log
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
                
                # Check for GM command: Requesting a roll from a specific player
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
