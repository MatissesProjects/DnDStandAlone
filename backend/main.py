import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import engine, get_db, Base
from websocket_manager import manager
import models
import auth

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

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str, role: str = "player"):
    # For now, we accept 'role' as a query param until frontend auth is fully wired
    await manager.connect(websocket, client_id, role)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message_json = json.loads(data)
                # Check if it's a subtle roll
                if message_json.get("isSubtle") is True:
                    # Only broadcast to GMs
                    await manager.broadcast(data, role_limit="gm")
                    # Also send back to the sender if they're not a GM (to confirm)
                    if role != "gm":
                        await manager.send_personal_message(data, client_id)
                else:
                    # Regular broadcast to everyone
                    await manager.broadcast(data)
            except json.JSONDecodeError:
                # If not JSON, just broadcast as is
                await manager.broadcast(data)
    except WebSocketDisconnect:
        manager.disconnect(client_id)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
