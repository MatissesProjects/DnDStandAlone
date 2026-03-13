import pytest
import json
import asyncio
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import Base, get_db
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import models
from app.api import auth

SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///./test_vtt_adv.db"
test_engine = create_engine(SQLALCHEMY_TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

async def mock_get_current_user_gm():
    return models.User(id=1, discord_id="gm_123", username="GM User", role="gm")

async def mock_get_current_user_player():
    return models.User(id=2, discord_id="player_456", username="Player User", role="player")

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()
    gm = models.User(id=1, discord_id="gm_123", username="GM User", role="gm")
    player = models.User(id=2, discord_id="player_456", username="Player User", role="player")
    db.add(gm)
    db.add(player)
    db.commit()
    db.close()
    yield

def test_initiative_actions():
    with client.websocket_connect("/ws/ROOM1/GM1?role=gm") as ws_gm:
        # Drain connection messages
        ws_gm.receive_json()
        ws_gm.receive_json()
        
        ws_gm.send_text(json.dumps({
            "type": "join_initiative",
            "id": "player_456",
            "name": "Player User",
            "initiative": 15,
            "isPlayer": True
        }))
        resp = ws_gm.receive_json()
        assert resp["type"] == "initiative_update"
        assert len(resp["combatants"]) == 1

def test_luck_modifier_application():
    with client.websocket_connect("/ws/ROOM2/PLAYER1?role=player") as ws_p:
        ws_p.receive_json()
        ws_p.receive_json()
        
        ws_p.send_text(json.dumps({"type": "vfx_trigger", "vfxType": "cheer"}))
        ws_p.receive_json() # vfx
        ws_p.receive_json() # luck update
        
        ws_p.send_text(json.dumps({"type": "roll", "die": "d20", "result": 10, "user": "Player User"}))
        msg1 = ws_p.receive_json()
        msg2 = ws_p.receive_json()
        
        roll_result = msg1 if msg1["type"] == "roll" else msg2
        assert roll_result["result"] == 11

def test_websocket_stability():
    # Test that connection survives multiple messages and correctly cleans up
    with client.websocket_connect("/ws/ROOM3/STABLE1?role=player") as ws:
        ws.receive_json() # luck
        ws.receive_json() # presence
        
        for i in range(5):
            ws.send_text(json.dumps({"type": "ping_test", "index": i}))
            # Just verify we don't disconnect
            resp = ws.receive_json()
            assert resp["index"] == i

def test_campaign_summary_context():
    app.dependency_overrides[auth.get_current_user] = mock_get_current_user_gm
    c_resp = client.post("/campaigns", json={"name": "Summary Test"})
    c_id = c_resp.json()["id"]
    client.post("/locations", json={"name": "Testing Grounds", "description": "A place for tests", "campaign_id": c_id})
    s_resp = client.get(f"/campaigns/{c_id}/summarize")
    assert s_resp.status_code == 200
