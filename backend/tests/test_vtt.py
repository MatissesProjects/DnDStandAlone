import pytest
import json
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import Base, engine, get_db
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import models
from app.api import auth

# Use a separate SQLite database for tests
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///./test_vtt.db"
test_engine = create_engine(SQLALCHEMY_TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

# Helper to mock authenticated user
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
    # Add a default GM user for tests
    db = TestingSessionLocal()
    gm = models.User(id=1, discord_id="gm_123", username="GM User", role="gm")
    db.add(gm)
    db.commit()
    db.close()
    yield

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_create_campaign_as_gm():
    app.dependency_overrides[auth.get_current_user] = mock_get_current_user_gm
    response = client.post("/campaigns", json={"name": "Epic Quest"})
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Epic Quest"
    assert "room_id" in data
    assert len(data["room_id"]) == 6

def test_create_campaign_as_player_fails():
    app.dependency_overrides[auth.get_current_user] = mock_get_current_user_player
    response = client.post("/campaigns", json={"name": "Failed Quest"})
    assert response.status_code == 403

def test_join_campaign():
    # Setup: Create a campaign first
    app.dependency_overrides[auth.get_current_user] = mock_get_current_user_gm
    create_resp = client.post("/campaigns", json={"name": "Joinable Quest"})
    room_id = create_resp.json()["room_id"]
    
    # Test joining
    app.dependency_overrides[auth.get_current_user] = None # Reset
    join_resp = client.get(f"/campaigns/join/{room_id}")
    assert join_resp.status_code == 200
    assert join_resp.json()["name"] == "Joinable Quest"

def test_create_location_as_gm():
    # Setup campaign
    app.dependency_overrides[auth.get_current_user] = mock_get_current_user_gm
    camp_resp = client.post("/campaigns", json={"name": "Loc Test"})
    camp_id = camp_resp.json()["id"]
    
    # Create location
    loc_resp = client.post("/locations", json={
        "name": "Dark Cave", 
        "description": "Spooky", 
        "campaign_id": camp_id
    })
    assert loc_resp.status_code == 200
    assert loc_resp.json()["name"] == "Dark Cave"

def test_websocket_room_scoping():
    # Test websocket connection and basic broadcast
    with client.websocket_connect("/ws/ROOM1/CLIENT1?role=gm") as websocket:
        # First message is usually presence
        presence = websocket.receive_json()
        assert presence["type"] == "presence"
        
        websocket.send_text(json.dumps({"isSubtle": False, "msg": "hello"}))
        data = websocket.receive_text()
        assert "hello" in data
