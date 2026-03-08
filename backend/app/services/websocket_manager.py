from typing import Dict, Set, List
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # active_connections[user_id] = websocket
        self.active_connections: Dict[str, WebSocket] = {}
        
        # room_map[room_id] = set(user_ids)
        self.room_map: Dict[str, Set[str]] = {}
        
        # user_metadata[user_id] = {"username": str, "role": str, "room_id": str, "class_name": str, "level": int}
        self.user_metadata: Dict[str, Dict[str, any]] = {}

    async def connect(self, websocket: WebSocket, user_id: str, room_id: str, role: str, username: str, class_name: str = None, level: int = 1):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        self.user_metadata[user_id] = {
            "username": username,
            "role": role,
            "room_id": room_id,
            "class_name": class_name,
            "level": level
        }
        
        if room_id not in self.room_map:
            self.room_map[room_id] = set()
        self.room_map[room_id].add(user_id)
        
        await self.broadcast_user_list(room_id)

    async def update_user_metadata(self, user_id: str, room_id: str, metadata: Dict[str, any]):
        if user_id in self.user_metadata:
            self.user_metadata[user_id].update(metadata)
            await self.broadcast_user_list(room_id)

    def disconnect(self, user_id: str, room_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        
        if user_id in self.user_metadata:
            del self.user_metadata[user_id]
            
        if room_id in self.room_map:
            if user_id in self.room_map[room_id]:
                self.room_map[room_id].remove(user_id)
            if not self.room_map[room_id]:
                del self.room_map[room_id]
        
        import asyncio
        asyncio.create_task(self.broadcast_user_list(room_id))

    async def broadcast_user_list(self, room_id: str):
        if room_id not in self.room_map:
            return
        
        users = []
        for u_id in self.room_map[room_id]:
            meta = self.user_metadata.get(u_id)
            if meta:
                users.append({
                    "id": u_id,
                    "username": meta["username"],
                    "role": meta["role"],
                    "class_name": meta.get("class_name"),
                    "level": meta.get("level", 1)
                })
        
        import json
        message = json.dumps({"type": "presence", "users": users})
        await self.broadcast(message, room_id)

    async def broadcast(self, message: str, room_id: str, role_limit: str = None):
        if room_id not in self.room_map:
            return

        target_user_ids = self.room_map[room_id]
        for user_id in target_user_ids:
            if role_limit and self.user_metadata.get(user_id, {}).get("role") != role_limit:
                continue
            if user_id in self.active_connections:
                await self.active_connections[user_id].send_text(message)

    async def send_personal_message(self, message: str, user_id: str):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_text(message)

manager = ConnectionManager()
