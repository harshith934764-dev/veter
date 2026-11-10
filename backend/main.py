from __future__ import annotations

import os
import time
import uuid
from typing import Any

import httpx
import jwt
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "veter-social")
MODEL_URL = os.getenv("VETER_MODEL_URL", "").rstrip("/")
MODEL_NAME = os.getenv("VETER_MODEL_NAME", "veter-core")
MODEL_TOKEN = os.getenv("VETER_MODEL_TOKEN", "")
CHAT_API_BASE = os.getenv("VETER_CHAT_API_BASE", "").rstrip("/")
CHAT_API_KEY = os.getenv("VETER_CHAT_API_KEY", "")
CHAT_MODEL = os.getenv("VETER_CHAT_MODEL", "llama-3.3-70b-versatile")
ALLOWED_ORIGINS = [
    item.strip()
    for item in os.getenv(
        "VETER_ALLOWED_ORIGINS",
        "https://theveter.in,https://www.theveter.in,https://veter-language.onrender.com",
    ).split(",")
    if item.strip()
]

app = FastAPI(title="VETER AI API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

bearer = HTTPBearer(auto_error=False)
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://qqvfphefusvbveucqbrj.supabase.co").rstrip("/")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
if not SUPABASE_ANON_KEY:
    # This is the public anon key already used by the VETER website. RLS remains
    # enforced with the signed-in Firebase ID token forwarded on each request.
    SUPABASE_ANON_KEY = os.getenv("VETER_SUPABASE_PUBLIC_KEY", "")



class ChatRequest(BaseModel):
    content: str = Field(min_length=1, max_length=12000)
    thread_id: str | None = None
    model: str | None = None


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> dict[str, Any]:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Sign in to Veter AI first.")
    token = credentials.credentials
    try:
        jwks = jwt.PyJWKClient(
            "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
        )
        signing_key = jwks.get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=PROJECT_ID,
            issuer=f"https://securetoken.google.com/{PROJECT_ID}",
            options={"require": ["exp", "iat", "sub", "aud", "iss"]},
        )
        if not claims.get("sub"):
            raise ValueError("Missing user id")
        return {"uid": claims["sub"], "email": claims.get("email", "")}
    except Exception:
        raise HTTPException(status_code=401, detail="Your sign-in token is invalid or expired. Sign in again.")


@app.get("/")
def root():
    return {"name": "VETER AI API", "version": "0.1.0", "status": "running"}


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "veter-ai-api",
        "engine_configured": bool((MODEL_URL and MODEL_TOKEN) or (CHAT_API_BASE and CHAT_API_KEY)),
        "engine": (CHAT_MODEL if CHAT_API_BASE and CHAT_API_KEY else MODEL_NAME if MODEL_URL and MODEL_TOKEN else None),
        "mode": "direct-api" if CHAT_API_BASE and CHAT_API_KEY else "self-hosted" if MODEL_URL and MODEL_TOKEN else "not-configured",
    }


@app.get("/v1/threads")
async def list_threads(user: dict = Depends(current_user), credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    return await supabase_request(
        "GET",
        "/rest/v1/ai_threads",
        credentials.credentials,
        params={"select": "id,title,model,created_at,updated_at", "owner_uid": f"eq.{user['uid']}", "order": "updated_at.desc", "limit": "100"},
    )


@app.get("/v1/threads/{thread_id}/messages")
async def list_messages(thread_id: str, user: dict = Depends(current_user), credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    try:
        uuid.UUID(thread_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    owned = await supabase_request(
        "GET",
        "/rest/v1/ai_threads",
        credentials.credentials,
        params={"select": "id", "id": f"eq.{thread_id}", "owner_uid": f"eq.{user['uid']}", "limit": "1"},
    )
    if not owned:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return await supabase_request(
        "GET",
        "/rest/v1/ai_messages",
        credentials.credentials,
        params={"select": "id,role,content,provider,created_at", "thread_id": f"eq.{thread_id}", "owner_uid": f"eq.{user['uid']}", "order": "created_at.asc", "limit": "500"},
    )


async def supabase_request(method: str, path: str, firebase_token: str, *, params=None, json_body=None):
    if not SUPABASE_ANON_KEY:
        raise HTTPException(status_code=503, detail="VETER chat storage is not configured.")
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {firebase_token}",
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=8.0)) as client:
            response = await client.request(method, SUPABASE_URL + path, headers=headers, params=params, json=json_body)
        if response.status_code >= 400:
            raise HTTPException(status_code=502, detail="VETER chat storage request failed.")
        if response.status_code == 204 or not response.content:
            return []
        return response.json()
    except HTTPException:
        raise
    except httpx.HTTPError:
        raise HTTPException(status_code=503, detail="VETER chat storage is temporarily unavailable.")


@app.post("/v1/chat")
async def chat(payload: ChatRequest, user: dict = Depends(current_user), credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    direct_api = bool(CHAT_API_BASE and CHAT_API_KEY)
    legacy_model = bool(MODEL_URL and MODEL_TOKEN)
    if not direct_api and not legacy_model:
        raise HTTPException(
            status_code=503,
            detail="VETER AI is online, but its AI provider is not connected. Configure the AI provider in Render Environment.",
        )

    thread_id = payload.thread_id
    if thread_id:
        try:
            uuid.UUID(thread_id)
        except ValueError:
            raise HTTPException(status_code=404, detail="Conversation not found.")
        owned = await supabase_request(
            "GET", "/rest/v1/ai_threads", credentials.credentials,
            params={"select": "id,title", "id": f"eq.{thread_id}", "owner_uid": f"eq.{user['uid']}", "limit": "1"},
        )
        if not owned:
            raise HTTPException(status_code=404, detail="Conversation not found.")
        thread = owned[0]
        history_rows = await supabase_request(
            "GET", "/rest/v1/ai_messages", credentials.credentials,
            params={"select": "role,content", "thread_id": f"eq.{thread_id}", "owner_uid": f"eq.{user['uid']}", "order": "created_at.asc", "limit": "40"},
        )
    else:
        created = await supabase_request(
            "POST", "/rest/v1/ai_threads", credentials.credentials,
            json_body={"owner_uid": user["uid"], "title": payload.content[:120], "model": payload.model},
        )
        if not created:
            raise HTTPException(status_code=502, detail="Could not create your conversation.")
        thread = created[0]
        thread_id = thread["id"]
        history_rows = []

    history = [{"role": row["role"], "content": row["content"]} for row in history_rows]
    history.append({"role": "user", "content": payload.content})
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0)) as client:
            if direct_api:
                response = await client.post(
                    f"{CHAT_API_BASE}/chat/completions",
                    headers={"Authorization": f"Bearer {CHAT_API_KEY}"},
                    json={
                        "model": payload.model or CHAT_MODEL,
                        "messages": [{"role": "system", "content": "You are VETER AI, a helpful assistant created for the VETER technology ecosystem. Be accurate, explain clearly, and help with programming, learning and building projects. Never claim to have executed code unless a tool actually did so."}] + history[-20:],
                        "stream": False,
                        "temperature": 0.5,
                    },
                )
                response.raise_for_status()
                result = response.json()
                answer = (result.get("choices") or [{}])[0].get("message", {}).get("content", "").strip()
            else:
                response = await client.post(
                    f"{MODEL_URL}/api/chat",
                    headers={"Authorization": f"Bearer {MODEL_TOKEN}"},
                    json={"model": payload.model or MODEL_NAME, "messages": history[-20:], "stream": False},
                )
                response.raise_for_status()
                result = response.json()
                answer = result.get("message", {}).get("content", "").strip()
        if not answer:
            raise ValueError("The VETER model returned an empty response.")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"VETER model runtime error: {exc}")

    now = int(time.time())
    await supabase_request(
        "POST", "/rest/v1/ai_messages", credentials.credentials,
        json_body=[
            {"thread_id": thread_id, "owner_uid": user["uid"], "role": "user", "content": payload.content, "provider": "VETER"},
            {"thread_id": thread_id, "owner_uid": user["uid"], "role": "assistant", "content": answer, "provider": "VETER"},
        ],
    )
    await supabase_request(
        "PATCH", "/rest/v1/ai_threads", credentials.credentials,
        params={"id": f"eq.{thread_id}", "owner_uid": f"eq.{user['uid']}"},
        json_body={"updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now)), "model": payload.model or CHAT_MODEL},
    )
    return {
        "thread_id": thread_id,
        "answer": answer,
        "provider": "VETER",
        "model": payload.model or (CHAT_MODEL if direct_api else MODEL_NAME),
    }

