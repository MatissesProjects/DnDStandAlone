import pytest
import urllib.parse
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import Base, engine, get_db
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import models

# Use a separate SQLite database for tests
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///./test_auth.db"
test_engine = create_engine(SQLALCHEMY_TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    yield

def test_login_url():
    response = client.get("/auth/login")
    assert response.status_code == 200
    assert "url" in response.json()
    assert "discord.com/api/oauth2/authorize" in response.json()["url"]

@pytest.mark.asyncio
async def test_callback_success(mocker):
    # Mock the Discord token response
    mock_token_resp = mocker.Mock()
    mock_token_resp.status_code = 200
    mock_token_resp.json.return_value = {"access_token": "mock_access_token"}
    
    # Mock the Discord user info response
    mock_user_resp = mocker.Mock()
    mock_user_resp.status_code = 200
    mock_user_resp.json.return_value = {
        "id": "123456789",
        "username": "testuser"
    }
    
    # Patch httpx.AsyncClient
    mock_client = mocker.patch("httpx.AsyncClient", autospec=True)
    instance = mock_client.return_value.__aenter__.return_value
    instance.post.return_value = mock_token_resp
    instance.get.return_value = mock_user_resp
    
    # We use follow_redirects=False to check the 307 redirect
    response = client.get("/auth/callback?code=mock_code", follow_redirects=False)
    
    if response.status_code == 422:
        print(f"DEBUG 422: {response.content}")
        
    assert response.status_code == 307
    location = response.headers["location"]
    assert "https://dnd.matissetec.dev/auth/callback" in location
    
    # Parse the redirect URL to check params
    parsed = urllib.parse.urlparse(location)
    params = urllib.parse.parse_qs(parsed.query)
    assert "token" in params
    assert params["username"][0] == "testuser"

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
