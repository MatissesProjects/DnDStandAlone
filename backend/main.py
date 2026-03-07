import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from typing import Optional, List
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import engine, get_db, Base
from websocket_manager import manager
import models
import auth
import schemas
import crud

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

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str, role: str = "player"):
    await manager.connect(websocket, client_id, role)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message_json = json.loads(data)
                if message_json.get("isSubtle") is True:
                    await manager.broadcast(data, role_limit="gm")
                    if role != "gm":
                        await manager.send_personal_message(data, client_id)
                else:
                    await manager.broadcast(data)
            except json.JSONDecodeError:
                await manager.broadcast(data)
    except WebSocketDisconnect:
        manager.disconnect(client_id)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
