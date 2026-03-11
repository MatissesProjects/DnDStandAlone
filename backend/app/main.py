import json
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status, Query
from typing import Optional, List, Any, Dict
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.db.database import engine, get_db, Base
from app.services.websocket_manager import manager
from app.models import models
from app.api import auth
from app.schemas import schemas
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
    allow_origins=["*"], 
    allow_credentials=False, # Wildcard origins and credentials are mutually exclusive
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)

@app.get("/health")
async def health_check(db: Session = Depends(get_db)):
    return {"status": "ok", "db_connected": True}

@app.get("/ping")
def ping():
    return {"pong": True}

@app.patch("/users/me", response_model=schemas.User)
def update_me(
    user_update: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    return crud.update_user(db=db, user_id=current_user.id, user_update=user_update)

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

@app.get("/users/me/campaigns", response_model=List[schemas.Campaign])
def read_my_campaigns(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    return crud.get_user_campaigns(db, user_id=current_user.id)

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

@app.delete("/campaigns/{campaign_id}")
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

@app.patch("/locations/{location_id}/canvas", response_model=schemas.Location)
def update_location_canvas(
    location_id: int,
    update: schemas.LocationUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "gm":
        raise HTTPException(status_code=403, detail="Only GMs can save canvas state")
    return crud.update_location(db=db, location_id=location_id, location_update=update)

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

@app.get("/campaigns/{campaign_id}/history", response_model=List[schemas.HistoryLog])
def read_campaign_history(
    campaign_id: int,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    include_private = current_user.role == "gm"
    return crud.get_history(db, campaign_id=campaign_id, limit=limit, include_private=include_private)

@app.post("/campaigns/{campaign_id}/history", response_model=schemas.HistoryLog)
def add_campaign_history(
    campaign_id: int,
    log: schemas.HistoryLogCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "gm" and log.event_type != "dice_roll":
        raise HTTPException(status_code=403, detail="Only GMs can record general history")
    return crud.create_history_log(db=db, log=log)

@app.delete("/campaigns/{campaign_id}/history/{log_id}")
def delete_campaign_history(
    campaign_id: int,
    log_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if crud.delete_history_log(db=db, log_id=log_id):
        return {"status": "ok"}
    raise HTTPException(status_code=404, detail="Log not found")

@app.get("/campaigns/{campaign_id}/summarize")
async def summarize_campaign(
    campaign_id: int,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    history = crud.get_history(db, campaign_id, limit=limit)
    summary = await ai_service.summarize_session(history)
    return {"summary": summary}

# Handout Endpoints
@app.get("/campaigns/{campaign_id}/handouts", response_model=List[schemas.Handout])
def read_handouts(campaign_id: int, db: Session = Depends(get_db)):
    return crud.get_handouts(db, campaign_id=campaign_id)

@app.post("/handouts", response_model=schemas.Handout)
def create_handout(
    handout: schemas.HandoutCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "gm":
        raise HTTPException(status_code=403, detail="Only GMs can create handouts")
    db_handout = crud.create_handout(db=db, handout=handout)
    return db_handout

@app.patch("/handouts/{handout_id}", response_model=schemas.Handout)
def update_handout(
    handout_id: int,
    handout_update: schemas.HandoutUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "gm":
        raise HTTPException(status_code=403, detail="Only GMs can move handouts")
    return crud.update_handout(db=db, handout_id=handout_id, handout_update=handout_update)

@app.delete("/handouts/{handout_id}")
def delete_handout(
    handout_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "gm":
        raise HTTPException(status_code=403, detail="Only GMs can delete handouts")
    if crud.delete_handout(db=db, handout_id=handout_id):
        return {"status": "ok"}
    raise HTTPException(status_code=404, detail="Handout not found")

# Location Endpoints
@app.get("/campaigns/{campaign_id}/locations", response_model=List[schemas.Location])
def read_locations(campaign_id: int, db: Session = Depends(get_db)):
    return crud.get_locations(db, campaign_id=campaign_id)

@app.get("/locations/{location_id}/entities", response_model=List[schemas.Entity])
def read_entities(location_id: int, db: Session = Depends(get_db)):
    return crud.get_entities(db, location_id=location_id)

@app.post("/entities", response_model=schemas.Entity)
def create_entity(
    entity: schemas.EntityCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "gm":
        raise HTTPException(status_code=403, detail="Only GMs can materialize entities")
    return crud.create_entity(db=db, entity=entity)

@app.patch("/entities/{entity_id}", response_model=schemas.Entity)
def update_entity(
    entity_id: int,
    entity_update: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "gm":
        raise HTTPException(status_code=403, detail="Only GMs can update entities")
    return crud.update_entity(db=db, entity_id=entity_id, entity_update=entity_update)

@app.delete("/entities/{entity_id}")
def delete_entity(
    entity_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "gm":
        raise HTTPException(status_code=403, detail="Only GMs can delete entities")
    if crud.delete_entity(db=db, entity_id=entity_id):
        return {"status": "ok"}
    raise HTTPException(status_code=404, detail="Entity not found")

@app.post("/save-library")
async def save_library(payload: dict, current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "gm":
        raise HTTPException(status_code=403, detail="Only GMs can save the library")
    
    try:
        import os
        # Ensure directory exists relative to project root
        file_path = os.path.join(os.getcwd(), "..", "ExcalidrawFiles", "library.excalidrawlib")
        file_path = os.path.abspath(file_path)
        
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)
            
        return {"status": "saved", "path": file_path}
    except Exception as e:
        logger.error(f"Error saving library: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/locations", response_model=schemas.Location)
def create_location(
    location: schemas.LocationCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "gm":
        raise HTTPException(status_code=403, detail="Only GMs can create locations")
    return crud.create_location(db=db, location=location)

@app.patch("/locations/{location_id}", response_model=schemas.Location)
def update_location(
    location_id: int,
    location_update: schemas.LocationUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "gm":
        raise HTTPException(status_code=403, detail="Only GMs can update locations")
    return crud.update_location(db=db, location_id=location_id, location_update=location_update)

@app.delete("/locations/{location_id}")
def delete_location(
    location_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "gm":
        raise HTTPException(status_code=403, detail="Only GMs can delete locations")
    if crud.delete_location(db=db, location_id=location_id):
        return {"status": "ok"}
    raise HTTPException(status_code=404, detail="Location not found")

# AI Endpoints
@app.post("/campaigns/{campaign_id}/generate-enemy")
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

@app.post("/campaigns/{campaign_id}/generate-lore")
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
        lore_text = await ai_service.generate_lore(location, history)
        
        crud.create_history_log(db, schemas.HistoryLogCreate(
            campaign_id=campaign_id,
            event_type="lore_update",
            content=f"AI Lore: {lore_text}"
        ))
        
        return {"lore": lore_text}
    except Exception as e:
        logger.error(f"Generate Lore Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/campaigns/{campaign_id}/generate-loot")
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

@app.websocket("/ws/{room_id}/{client_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, client_id: str, role: str = "player", username: str = "Anonymous", scene_id: str = "main"):
    print(f"[WS] Connection attempt: {client_id} (Role: {role}, Room: {room_id}, Scene: {scene_id}) from {websocket.client.host}")
    await manager.connect(websocket, client_id, room_id, role, username, scene_id=scene_id)
    print(f"[WS] Connection established: {client_id}")
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message_json = json.loads(data)
                
                # Update user metadata in real-time
                if message_json.get("type") == "user_update":
                    await manager.update_user_metadata(client_id, room_id, {
                        "class_name": message_json.get("class_name"),
                        "level": message_json.get("level")
                    })
                    continue

                if message_json.get("type") == "move_to_scene" and role == "gm":
                    target_id = message_json.get("target_id")
                    new_scene = message_json.get("scene_id")
                    if target_id and new_scene:
                        await manager.update_user_metadata(target_id, room_id, {"scene_id": new_scene})
                    continue

                if message_json.get("type") == "initiative_update" and role == "gm":
                    # Broadcast to everyone
                    await manager.broadcast(data, room_id, sender_id=client_id)
                    continue

                if message_json.get("type") == "request_roll" and role == "gm":
                    target_id = message_json.get("target_id")
                    if target_id:
                        await manager.send_personal_message(data, target_id)
                    continue

                if message_json.get("type") == "whisper":
                    target_id = message_json.get("target_id")
                    if target_id:
                        # Send to target
                        await manager.send_personal_message(data, target_id)
                        # Also send back to sender for their own UI (if not target)
                        if target_id != client_id:
                            await manager.send_personal_message(data, client_id)
                    continue

                if message_json.get("isSubtle") is True:
                    await manager.broadcast(data, room_id, role_limit="gm", sender_id=client_id)
                    if role != "gm":
                        await manager.send_personal_message(data, client_id)
                else:
                    await manager.broadcast(data, room_id, sender_id=client_id)
            except json.JSONDecodeError:
                await manager.broadcast(data, room_id)
    except WebSocketDisconnect:
        print(f"[WS] Connection lost abnormally or closed: {client_id}")
        manager.disconnect(client_id, room_id)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
