import httpx
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from typing import Optional
from app.db.database import get_db
from app.core.config import settings
from app.models import models
import urllib.parse

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()

# Discord API Endpoints
DISCORD_API_BASE = "https://discord.com/api/v10"
DISCORD_TOKEN_URL = f"{DISCORD_API_BASE}/oauth2/token"
DISCORD_USER_URL = f"{DISCORD_API_BASE}/users/@me"

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

async def get_current_user(auth: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token = auth.credentials
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        discord_id: str = payload.get("sub")
        if discord_id is None:
            raise credentials_exception
    except JWTError as e:
        print(f"JWT Decode Error: {e}")
        raise credentials_exception
    
    user = db.query(models.User).filter(models.User.discord_id == discord_id).first()
    if user is None:
        print(f"User with discord_id {discord_id} not found in database (was it wiped?)")
        raise credentials_exception
    return user

@router.get("/login")
async def login():
    # Construct the Discord authorization URL
    scopes = "identify"
    auth_url = (
        f"https://discord.com/api/oauth2/authorize"
        f"?client_id={settings.DISCORD_CLIENT_ID}"
        f"&redirect_uri={settings.DISCORD_REDIRECT_URI}"
        f"&response_type=code"
        f"&scope={scopes}"
    )
    return RedirectResponse(url=auth_url)

@router.get("/guest")
async def guest_login(db: Session = Depends(get_db)):
    guest_id = f"guest_{uuid.uuid4().hex[:8]}"
    username = f"Guest_{guest_id[-4:]}"
    
    user = models.User(
        discord_id=guest_id,
        username=username,
        role="player"
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    jwt_token = create_access_token(
        data={"sub": user.discord_id, "role": user.role}
    )
    
    return {
        "token": jwt_token,
        "user": {
            "username": user.username,
            "role": user.role,
            "discord_id": user.discord_id
        }
    }

@router.get("/callback")
async def callback(code: str, db: Session = Depends(get_db)):
    # Exchange code for token
    data = {
        "client_id": settings.DISCORD_CLIENT_ID,
        "client_secret": settings.DISCORD_CLIENT_SECRET,
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": settings.DISCORD_REDIRECT_URI,
    }
    headers = {"Content-Type": "application/x-www-form-urlencoded"}

    async with httpx.AsyncClient() as client:
        token_response = await client.post(DISCORD_TOKEN_URL, data=data, headers=headers)
        if token_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to get token from Discord")
        
        token_data = token_response.json()
        access_token = token_data["access_token"]

        user_response = await client.get(
            DISCORD_USER_URL, 
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if user_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to get user info from Discord")
        
        user_info = user_response.json()
        discord_id = user_info["id"]
        username = user_info["username"]

        user = db.query(models.User).filter(models.User.discord_id == discord_id).first()
        if not user:
            # Check if there are any other Discord users (non-guests)
            has_other_discord_users = db.query(models.User).filter(~models.User.discord_id.startswith("guest_")).count() > 0
            
            user = models.User(
                discord_id=discord_id, 
                username=username, 
                role="player" if has_other_discord_users else "gm"
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        jwt_token = create_access_token(
            data={"sub": user.discord_id, "role": user.role}
        )
        
        print(f"User {user.username} authenticated. Redirecting to frontend...")
        # REDIRECT back to frontend with the data in params
        frontend_callback = "http://localhost:5173/auth/callback"
        params = urllib.parse.urlencode({
            "token": jwt_token,
            "username": user.username,
            "role": user.role,
            "discord_id": user.discord_id
        })
        return RedirectResponse(url=f"{frontend_callback}?{params}")
