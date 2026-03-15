from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
import httpx
import logging

router = APIRouter(tags=["audio"])
logger = logging.getLogger(__name__)

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
