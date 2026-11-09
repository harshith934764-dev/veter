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
threads: dict[str, dict[str, Any]] = {}
messages: dict[str, list[dict[str, str]]] = {}


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
        "engine_configured": bool(MODEL_URL),
        "engine": MODEL_NAME if MODEL_URL else None,
    }


@app.get("/v1/threads")
def list_threads(user: dict = Depends(current_user)):
    owned = [t for t in threads.values() if t["uid"] == user["uid"]]
    return sorted(owned, key=lambda t: t["updated_at"], reverse=True)


@app.get("/v1/threads/{thread_id}/messages")
def list_messages(thread_id: str, user: dict = Depends(current_user)):
    thread = threads.get(thread_id)
    if not thread or thread["uid"] != user["uid"]:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return messages.get(thread_id, [])


@app.post("/v1/chat")
async def chat(payload: ChatRequest, user: dict = Depends(current_user)):
    if not MODEL_URL:
        raise HTTPException(
            status_code=503,
            detail=(
                "VETER AI API is online, but its own model engine is not connected yet. "
                "The next step is to connect the VETER model runtime."
            ),
        )

    thread_id = payload.thread_id or str(uuid.uuid4())
    thread = threads.get(thread_id)
    if thread and thread["uid"] != user["uid"]:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    if not thread:
        thread = {
            "id": thread_id,
            "uid": user["uid"],
            "title": payload.content[:60],
            "updated_at": int(time.time()),
        }
        threads[thread_id] = thread

    history = messages.setdefault(thread_id, [])
    history.append({"role": "user", "content": payload.content})
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0)) as client:
            response = await client.post(
                f"{MODEL_URL}/api/chat",
                json={
                    "model": payload.model or MODEL_NAME,
                    "messages": history[-20:],
                    "stream": False,
                },
            )
            response.raise_for_status()
            result = response.json()
        answer = result.get("message", {}).get("content", "").strip()
        if not answer:
            raise ValueError("The VETER model returned an empty response.")
    except Exception as exc:
        history.pop()
        raise HTTPException(status_code=502, detail=f"VETER model runtime error: {exc}")

    history.append({"role": "assistant", "content": answer})
    thread["updated_at"] = int(time.time())
    return {
        "thread_id": thread_id,
        "answer": answer,
        "provider": "VETER",
        "model": payload.model or MODEL_NAME,
    }
