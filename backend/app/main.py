import json
import logging
import os
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.db.database import engine, get_db
from app.services.websocket_manager import manager
from app.models import models
from app.api import auth, campaigns, locations, ai, audio, users

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create database tables
try:
    models.Base.metadata.create_all(bind=engine)
    logger.info("Database tables verified/created successfully")
except Exception as e:
    logger.error(f"Error connecting to database: {e}")

app = FastAPI(title="DnD VTT API")

# Mount the uploads directory
if not os.path.exists("uploads"):
    os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# CORS Configuration
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "https://dnd.matissetec.dev",
    "https://wss.matissetec.dev",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(campaigns.router)
app.include_router(locations.router)
app.include_router(ai.router)
app.include_router(audio.router)

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

@app.post("/save-library")
async def save_library(payload: dict, current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "gm":
        raise HTTPException(status_code=403, detail="Only GMs can save the library")
    
    try:
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

@app.websocket("/ws/{room_id}/{client_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, client_id: str, role: str = "player", username: str = "Anonymous", scene_id: str = "main"):
    await manager.connect(websocket, client_id, room_id, role, username, scene_id=scene_id)
    
    async def heartbeat():
        import time
        try:
            while True:
                await asyncio.sleep(30)
                await websocket.send_text(json.dumps({"type": "ping", "timestamp": int(time.time() * 1000)}))
        except:
            pass

    heartbeat_task = asyncio.create_task(heartbeat())

    try:
        while True:
            data = await websocket.receive_text()
            try:
                message_json = json.loads(data)
                if message_json.get("type") == "pong": continue

                if message_json.get("type") == "user_update":
                    await manager.update_user_metadata(client_id, room_id, {
                        "class_name": message_json.get("class_name"),
                        "level": message_json.get("level")
                    })
                    continue

                if message_json.get("type") in ["join_initiative", "remove_initiative", "next_turn", "clear_initiative"]:
                    if message_json.get("type") == "join_initiative" or role == "gm":
                        await manager.handle_initiative_action(room_id, message_json)
                    continue

                if message_json.get("type") == "vfx_trigger":
                    await manager.handle_vfx_action(room_id, message_json)
                    continue

                if message_json.get("type") == "roll":
                    if role == "player" and room_id in manager.room_luck:
                        luck = manager.room_luck[room_id]
                        if luck != 0:
                            message_json["result"] += luck
                            message_json["content"] = f"{message_json.get('die')}: {message_json['result']} (Luck: {'+' if luck > 0 else ''}{luck})"
                            manager.room_luck[room_id] = 0
                            await manager.broadcast(json.dumps({"type": "luck_update", "modifier": 0}), room_id)
                    await manager.broadcast(json.dumps(message_json), room_id, sender_id=client_id)
                    continue

                if message_json.get("type") == "move_to_scene" and role == "gm":
                    target_id = message_json.get("target_id")
                    new_scene = message_json.get("scene_id")
                    if target_id and new_scene:
                        await manager.update_user_metadata(target_id, room_id, {"scene_id": new_scene})
                    continue

                if message_json.get("type") == "initiative_update" and role == "gm":
                    await manager.broadcast(data, room_id, sender_id=client_id)
                    continue

                if message_json.get("type") == "request_roll" and role == "gm":
                    target_id = message_json.get("target_id")
                    if target_id == "all":
                        await manager.broadcast(data, room_id, sender_id=client_id)
                    elif target_id:
                        await manager.send_personal_message(data, target_id)
                    continue

                if message_json.get("type") == "whisper":
                    target_id = message_json.get("target_id")
                    if target_id:
                        await manager.send_personal_message(data, target_id)
                        if target_id != client_id: await manager.send_personal_message(data, client_id)
                    continue

                if message_json.get("isSubtle") is True:
                    await manager.broadcast(data, room_id, role_limit="gm", sender_id=client_id)
                    if role != "gm": await manager.send_personal_message(data, client_id)
                else:
                    await manager.broadcast(data, room_id, sender_id=client_id)
            except json.JSONDecodeError:
                await manager.broadcast(data, room_id)
    except WebSocketDisconnect:
        manager.disconnect(client_id, room_id)
    finally:
        heartbeat_task.cancel()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
