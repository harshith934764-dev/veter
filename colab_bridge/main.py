import os
import hmac

import httpx
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse

app = FastAPI(
    title="VETER Colab Bridge",
    version="0.1.0",
    description="Authenticated, read-only proxy to the active VETER Colab runtime.",
)

def config():
    base = os.getenv("COLAB_BRIDGE_URL", "").strip().rstrip("/")
    token = os.getenv("COLAB_BRIDGE_TOKEN", "").strip()
    return base, token

def require_auth(authorization: str | None):
    expected = os.getenv("BRIDGE_API_KEY", "").strip()
    if not expected:
        raise HTTPException(status_code=503, detail="Bridge API key is not configured.")
    supplied = authorization or ""
    if not supplied.startswith("Bearer ") or not hmac.compare_digest(supplied[7:], expected):
        raise HTTPException(status_code=401, detail="Invalid bearer token.")

async def colab_request(method: str, path: str, authorization: str | None):
    require_auth(authorization)
    base, token = config()
    if not base or not token:
        raise HTTPException(status_code=503, detail="Colab runtime URL/token not configured.")
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=False) as client:
            response = await client.request(
                method, f"{base}{path}",
                headers={"Authorization": f"Bearer {token}"},
                json={} if method == "POST" else None,
            )
        response.raise_for_status()
        return JSONResponse(content=response.json())
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"Colab runtime returned HTTP {exc.response.status_code}.")
    except (httpx.RequestError, ValueError):
        raise HTTPException(status_code=502, detail="Could not reach Colab runtime or parse its response.")

@app.get("/")
async def root():
    return {"service": "veter-colab-bridge", "status": "ready", "docs": "/docs"}

@app.get("/health")
async def health():
    base, token = config()
    return {
        "service": "veter-colab-bridge",
        "status": "ready",
        "colab_configured": bool(base and token),
        "api_key_configured": bool(os.getenv("BRIDGE_API_KEY", "").strip()),
        "mode": "read-only",
    }

@app.get("/colab/health")
async def colab_health(authorization: str | None = Header(default=None)):
    return await colab_request("GET", "/health", authorization)

@app.get("/colab/veter/files")
async def veter_files(authorization: str | None = Header(default=None)):
    return await colab_request("GET", "/veter/files", authorization)

@app.post("/colab/veter/check")
async def veter_check(authorization: str | None = Header(default=None)):
    return await colab_request("POST", "/veter/check", authorization)
