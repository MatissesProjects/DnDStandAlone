from typing import Dict, Set
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # active_connections[user_id] = websocket
        self.active_connections: Dict[str, WebSocket] = {}
        # role_map[role] = set(user_ids)
        self.role_map: Dict[str, Set[str]] = {
            "gm": set(),
            "player": set()
        }

    async def connect(self, websocket: WebSocket, user_id: str, role: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        if role not in self.role_map:
            self.role_map[role] = set()
        self.role_map[role].add(user_id)

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        # Remove from role map
        for role_users in self.role_map.values():
            if user_id in role_users:
                role_users.remove(user_id)
                break

    async def send_personal_message(self, message: str, user_id: str):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_text(message)

    async def broadcast(self, message: str, role_limit: str = None):
        """
        Broadcasts a message. If role_limit is provided, only sends to users with that role.
        """
        if role_limit:
            target_ids = self.role_map.get(role_limit, set())
            for user_id in target_ids:
                if user_id in self.active_connections:
                    await self.active_connections[user_id].send_text(message)
        else:
            for connection in self.active_connections.values():
                await connection.send_text(message)

manager = ConnectionManager()
