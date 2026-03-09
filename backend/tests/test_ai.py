import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch
from app.main import app
from app.db.database import Base, engine, get_db
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import models
from app.api import auth

# Use a separate SQLite database for tests
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///./test_ai.db"
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

app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[auth.get_current_user] = mock_get_current_user_gm

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

@pytest.mark.asyncio
async def test_generate_enemy():
    # Setup campaign and location
    db = TestingSessionLocal()
    campaign = models.Campaign(id=1, name="Test Campaign", room_id="TEST01", gm_id=1)
    location = models.Location(id=1, name="Forest", campaign_id=1)
    db.add(campaign)
    db.add(location)
    db.commit()
    db.close()

    mock_enemy = {
        "name": "Mock Goblin",
        "stats": {"hp": 10, "ac": 12},
        "backstory": "A sneaky mock goblin."
    }

    with patch("app.main.ai_service.generate_enemy", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = mock_enemy
        
        response = client.post("/campaigns/1/generate-enemy?location_id=1")
        assert response.status_code == 200
        assert response.json()["name"] == "Mock Goblin"
        mock_gen.assert_called_once()

@pytest.mark.asyncio
async def test_generate_lore():
    # Setup campaign and location
    db = TestingSessionLocal()
    campaign = models.Campaign(id=1, name="Test Campaign", room_id="TEST01", gm_id=1)
    location = models.Location(id=1, name="Forest", campaign_id=1)
    db.add(campaign)
    db.add(location)
    db.commit()
    db.close()

    with patch("app.main.ai_service.generate_lore", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = "Ancient trees whisper secrets."
        
        response = client.post("/campaigns/1/generate-lore?location_id=1")
        assert response.status_code == 200
        assert "lore" in response.json()
        assert response.json()["lore"] == "Ancient trees whisper secrets."
        mock_gen.assert_called_once()
