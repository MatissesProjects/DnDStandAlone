import pytest
import json
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
        # Drain connection messages: luck_update and presence
        ws_gm.receive_json()
        ws_gm.receive_json()
        
        # 1. Join initiative (Player)
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
        assert resp["combatants"][0]["name"] == "Player User"

        # 2. Join initiative (NPC)
        ws_gm.send_text(json.dumps({
            "type": "join_initiative",
            "id": "npc_1",
            "name": "Goblin",
            "initiative": 10,
            "isPlayer": False
        }))
        resp = ws_gm.receive_json()
        assert len(resp["combatants"]) == 2
        assert resp["combatants"][0]["name"] == "Player User"

        # 3. Next Turn (GM)
        ws_gm.send_text(json.dumps({"type": "next_turn"}))
        resp = ws_gm.receive_json()
        assert resp["currentTurn"] == 1

def test_luck_modifier_application():
    with client.websocket_connect("/ws/ROOM2/PLAYER1?role=player") as ws_p:
        # Drain connection messages: luck_update and presence
        ws_p.receive_json()
        ws_p.receive_json()
        
        # 1. Trigger Cheer (Luck +1)
        ws_p.send_text(json.dumps({"type": "vfx_trigger", "vfxType": "cheer"}))
        vfx_resp = ws_p.receive_json()
        assert vfx_resp["type"] == "vfx_trigger"
        luck_update = ws_p.receive_json()
        assert luck_update["type"] == "luck_update"
        assert luck_update["modifier"] == 1

        # 2. Roll Die (Luck should apply)
        ws_p.send_text(json.dumps({
            "type": "roll",
            "die": "d20",
            "result": 10,
            "user": "Player User"
        }))
        
        # We expect two messages: the luck reset AND the roll result
        msg1 = ws_p.receive_json()
        msg2 = ws_p.receive_json()
        
        # Find which is which
        luck_reset = msg1 if msg1["type"] == "luck_update" else msg2
        roll_result = msg1 if msg1["type"] == "roll" else msg2
        
        assert luck_reset["modifier"] == 0
        assert roll_result["result"] == 11
        assert "Luck: +1" in roll_result["content"]

def test_campaign_summary_context():
    app.dependency_overrides[auth.get_current_user] = mock_get_current_user_gm
    c_resp = client.post("/campaigns", json={"name": "Summary Test"})
    c_id = c_resp.json()["id"]
    client.post("/locations", json={"name": "Testing Grounds", "description": "A place for tests", "campaign_id": c_id})
    s_resp = client.get(f"/campaigns/{c_id}/summarize")
    assert s_resp.status_code == 200
    assert "summary" in s_resp.json()
