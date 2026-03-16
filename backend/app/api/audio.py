from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Form
from fastapi.responses import Response
import httpx
import logging
import os
import shutil
from typing import List
from app.api.auth import get_current_user
from app.models.models import User

router = APIRouter(tags=["audio"])
logger = logging.getLogger(__name__)

# Ensure upload directories exist
UPLOAD_DIR = "uploads/audio"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(f"{UPLOAD_DIR}/atmosphere", exist_ok=True)
os.makedirs(f"{UPLOAD_DIR}/music", exist_ok=True)

@router.get("/proxy-audio")
async def proxy_audio(url: str):
    """Proxy external audio files to bypass CORS."""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        async with httpx.AsyncClient(follow_redirects=True) as client:
            resp = await client.get(url, headers=headers, timeout=15.0)
            if resp.status_code != 200:
                logger.error(f"Audio proxy failed for {url}: Status {resp.status_code}")
                raise HTTPException(status_code=resp.status_code, detail=f"External source returned {resp.status_code}")
            
            return Response(
                content=resp.content,
                media_type=resp.headers.get("content-type", "audio/mpeg"),
                headers={
                    "Cache-Control": "max-age=3600",
                    "Access-Control-Allow-Origin": "*"
                }
            )
    except Exception as e:
        logger.error(f"Proxy error for {url}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Proxy error: {str(e)}")

@router.post("/upload")
async def upload_audio(
    file: UploadFile = File(...),
    category: str = Form(...), # "atmosphere" or "music"
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "gm":
        raise HTTPException(status_code=403, detail="Only GMs can upload audio")
    
    if category not in ["atmosphere", "music"]:
        raise HTTPException(status_code=400, detail="Invalid category")
    
    # Create a safe filename
    filename = file.filename.replace(" ", "_")
    file_path = os.path.join(UPLOAD_DIR, category, filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        return {
            "filename": filename,
            "url": f"/uploads/audio/{category}/{filename}",
            "label": filename.split(".")[0].replace("_", " ").title()
        }
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/list")
async def list_audio(current_user: User = Depends(get_current_user)):
    # Everyone can list, but maybe restricted to GM if needed
    result = {
        "atmosphere": [],
        "music": []
    }
    
    for cat in ["atmosphere", "music"]:
        cat_dir = os.path.join(UPLOAD_DIR, cat)
        if os.path.exists(cat_dir):
            for filename in os.listdir(cat_dir):
                if filename.endswith((".mp3", ".wav", ".ogg", ".m4a")):
                    result[cat].append({
                        "label": filename.split(".")[0].replace("_", " ").title(),
                        "url": f"/uploads/audio/{cat}/{filename}"
                    })
    
    return result
