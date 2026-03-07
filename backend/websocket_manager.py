from typing import Dict, Set, List
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # active_connections[user_id] = websocket
        self.active_connections: Dict[str, WebSocket] = {}
        
        # room_map[room_id] = set(user_ids)
        self.room_map: Dict[str, Set[str]] = {}
        
        # role_map[user_id] = role ("gm" or "player")
        self.role_map: Dict[str, str] = {}

    async def connect(self, websocket: WebSocket, user_id: str, room_id: str, role: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        self.role_map[user_id] = role
        
        if room_id not in self.room_map:
            self.room_map[room_id] = set()
        self.room_map[room_id].add(user_id)

    def disconnect(self, user_id: str, room_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        
        if user_id in self.role_map:
            del self.role_map[user_id]
            
        if room_id in self.room_map:
            if user_id in self.room_map[room_id]:
                self.room_map[room_id].remove(user_id)
            if not self.room_map[room_id]:
                del self.room_map[room_id]

    async def broadcast(self, message: str, room_id: str, role_limit: str = None):
        """
        Broadcasts a message to a specific room.
        If role_limit is provided, only sends to users in that room with that role.
        """
        if room_id not in self.room_map:
            return

        target_user_ids = self.room_map[room_id]
        
        for user_id in target_user_ids:
            if role_limit and self.role_map.get(user_id) != role_limit:
                continue
                
            if user_id in self.active_connections:
                await self.active_connections[user_id].send_text(message)

    async def send_personal_message(self, message: str, user_id: str):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_text(message)

manager = ConnectionManager()
