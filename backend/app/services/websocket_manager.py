from typing import Dict, Set, List, Any
from fastapi import WebSocket
import json
import asyncio
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # active_connections[user_id] = websocket
        self.active_connections: Dict[str, WebSocket] = {}
        
        # room_map[room_id] = set(user_ids)
        self.room_map: Dict[str, Set[str]] = {}
        
        # user_metadata[user_id] = {"username": str, "role": str, "room_id": str, "scene_id": str, "class_name": str, "level": int}
        self.user_metadata: Dict[str, Dict[str, Any]] = {}

    async def connect(self, websocket: WebSocket, user_id: str, room_id: str, role: str, username: str, class_name: str = None, level: int = 1, scene_id: str = "main"):
        await websocket.accept()
        
        # If this user was already connected, clean up the old one first
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].close()
            except:
                pass
        
        self.active_connections[user_id] = websocket
        self.user_metadata[user_id] = {
            "username": username,
            "role": role,
            "room_id": room_id,
            "scene_id": scene_id,
            "class_name": class_name,
            "level": level
        }
        
        if room_id not in self.room_map:
            self.room_map[room_id] = set()
        self.room_map[room_id].add(user_id)
        
        # Inform others - wrapped in try to prevent handshake failure
        try:
            await self.broadcast_user_list(room_id)
        except Exception as e:
            logger.error(f"Error during post-connect broadcast: {e}")

    async def update_user_metadata(self, user_id: str, room_id: str, metadata: Dict[str, Any]):
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
        
        # Use a background task so we don't block the closure
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
                    "scene_id": meta.get("scene_id", "main"),
                    "class_name": meta.get("class_name"),
                    "level": meta.get("level", 1)
                })
        
        message = json.dumps({"type": "presence", "users": users})
        await self.broadcast(message, room_id)

    async def broadcast(self, message: str, room_id: str, role_limit: str = None, sender_id: str = None, scene_limit: bool = True):
        if room_id not in self.room_map:
            return

        is_subtle = False
        target_scene = None
        
        try:
            msg_data = json.loads(message)
            is_subtle = msg_data.get("isSubtle") is True
            # Allow messages to target a specific scene explicitly
            target_scene = msg_data.get("scene_id")
            
            # Presence and global orchestrated moves (like a full party TP) still go to everyone
            if msg_data.get("type") in ["presence"] or msg_data.get("global") is True:
                scene_limit = False
        except:
            pass

        # If no explicit target scene, use the sender's scene as the limit
        if scene_limit and not target_scene and sender_id and sender_id in self.user_metadata:
            target_scene = self.user_metadata[sender_id].get("scene_id", "main")

        target_user_ids = list(self.room_map[room_id])
        for user_id in target_user_ids:
            user_meta = self.user_metadata.get(user_id, {})
            user_role = user_meta.get("role")
            user_scene = user_meta.get("scene_id", "main")

            # GMs always receive everything to maintain "All-Seeing" status
            if user_role == "gm":
                pass 
            else:
                # If subtle, only original sender sees it
                if is_subtle and user_id != sender_id:
                    continue
                
                # Scene Limitation: If a target scene is set (or inferred), player must be in it
                if scene_limit and target_scene and user_scene != target_scene:
                    # Exception: ignore scene limit if this message is from the user themselves
                    if user_id != sender_id:
                        continue

            if user_id in self.active_connections:
                try:
                    await self.active_connections[user_id].send_text(message)
                except Exception:
                    pass

    async def send_personal_message(self, message: str, user_id: str):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_text(message)
            except:
                pass

manager = ConnectionManager()
