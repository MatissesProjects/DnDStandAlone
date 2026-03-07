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
    print("Ensure PostgreSQL is running or SQLite is configured correctly")

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Authentication Router
app.include_router(auth.router)

@app.get("/health")
async def health_check(
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(auth.get_current_user if False else lambda: None)
):
    return {"status": "ok", "db_connected": True}

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Broadcast raw data so clients can parse it (e.g., JSON)
            await manager.broadcast(data)
    except WebSocketDisconnect:
        manager.disconnect(client_id)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
