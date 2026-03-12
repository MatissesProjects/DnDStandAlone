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
        
        # user_metadata[user_id] = {"username": str, "role": str, "room_id": str, "scene_id": str...}
        self.user_metadata: Dict[str, Dict[str, Any]] = {}

        # scene_locations[room_id][scene_id] = location_data_json
        self.scene_locations: Dict[str, Dict[str, Any]] = {}

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
            self.scene_locations[room_id] = {}
        self.room_map[room_id].add(user_id)
        
        # Sync current scene location to new user
        scene_loc = self.scene_locations.get(room_id, {}).get(scene_id)
        if scene_loc:
            await websocket.send_text(json.dumps({"type": "location_update", "location": scene_loc}))

        # Inform others
        try:
            await self.broadcast_user_list(room_id)
        except Exception as e:
            logger.error(f"Error during post-connect broadcast: {e}")

    async def update_user_metadata(self, user_id: str, room_id: str, metadata: Dict[str, Any]):
        if user_id in self.user_metadata:
            old_scene = self.user_metadata[user_id].get("scene_id")
            self.user_metadata[user_id].update(metadata)
            new_scene = self.user_metadata[user_id].get("scene_id")
            
            # 1. Inform everyone about the move first
            await self.broadcast_user_list(room_id)
            
            # 2. Then sync the new location to the moved user
            if old_scene != new_scene:
                scene_loc = self.scene_locations.get(room_id, {}).get(new_scene)
                if scene_loc and user_id in self.active_connections:
                    await self.active_connections[user_id].send_text(json.dumps({"type": "location_update", "location": scene_loc}))

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
                if room_id in self.scene_locations:
                    del self.scene_locations[room_id]
        
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
            # Check for BOTH target_scene (new) and scene_id (legacy/other)
            target_scene = msg_data.get("target_scene") or msg_data.get("scene_id")
            
            # Store location updates in the scene state
            if msg_data.get("type") == "location_update":
                loc_scene = target_scene or (self.user_metadata.get(sender_id, {}).get("scene_id", "main") if sender_id else "main")
                if room_id not in self.scene_locations:
                    self.scene_locations[room_id] = {}
                self.scene_locations[room_id][loc_scene] = msg_data.get("location")

            if msg_data.get("type") in ["presence"] or msg_data.get("global") is True:
                scene_limit = False
        except:
            pass

        if scene_limit and not target_scene and sender_id and sender_id in self.user_metadata:
            target_scene = self.user_metadata[sender_id].get("scene_id", "main")

        target_user_ids = list(self.room_map[room_id])
        for user_id in target_user_ids:
            user_meta = self.user_metadata.get(user_id, {})
            user_role = user_meta.get("role")
            user_scene = user_meta.get("scene_id", "main")

            if user_role == "gm":
                pass 
            else:
                if is_subtle and user_id != sender_id:
                    continue
                
                if scene_limit and target_scene and user_scene != target_scene:
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
