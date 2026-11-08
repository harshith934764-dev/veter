import os, uuid
from datetime import datetime, timezone
from typing import Optional
import httpx
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "").rstrip("/")
MODEL = os.getenv("VETER_AI_MODEL", "openai/gpt-4o-mini")
APP_ORIGINS = [x.strip() for x in os.getenv("APP_ORIGINS", "https://theveter.in,https://www.theveter.in,http://localhost:8000").split(",") if x.strip()]
SYSTEM_PROMPT = """You are Veter AI, the helpful assistant built by Veter. Be accurate, clear, kind and practical. Explain complex ideas in accessible language. Never claim to have performed actions you did not perform. If uncertain, say so. Do not invent sources, current facts, or capabilities. Protect private information. For dangerous requests, prioritize safety and offer benign alternatives."""
app = FastAPI(title="Veter AI API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=APP_ORIGINS, allow_credentials=True, allow_methods=["GET","POST","DELETE","OPTIONS"], allow_headers=["Authorization","Content-Type"])

class ChatInput(BaseModel):
    content: str = Field(min_length=1, max_length=12000)
    thread_id: Optional[str] = None
    model: Optional[str] = None

async def user_from_token(token: str):
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(503, "Veter AI backend is not configured with Supabase.")
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(f"{SUPABASE_URL}/auth/v1/user", headers={"apikey":SUPABASE_ANON_KEY,"Authorization":f"Bearer {token}"})
    if response.status_code != 200:
        raise HTTPException(401, "Please sign in again to use Veter AI.")
    return response.json()

def db_headers(token: str):
    return {"apikey":SUPABASE_ANON_KEY,"Authorization":f"Bearer {token}","Content-Type":"application/json","Prefer":"return=representation"}

async def db_request(method: str, path: str, token: str, **kwargs):
    async with httpx.AsyncClient(timeout=25) as client:
        response = await client.request(method, f"{SUPABASE_URL}/rest/v1/{path}", headers=db_headers(token), **kwargs)
    if response.status_code >= 400:
        raise HTTPException(response.status_code, "Database request failed. Check Veter AI database policies.")
    return response.json() if response.content else None

def provider_config(requested_model: Optional[str]):
    model = requested_model or MODEL
    if OPENROUTER_API_KEY:
        return "openrouter", "https://openrouter.ai/api/v1/chat/completions", OPENROUTER_API_KEY, model
    if OPENAI_API_KEY:
        return "openai", "https://api.openai.com/v1/chat/completions", OPENAI_API_KEY, model if model.startswith("gpt-") else "gpt-4o-mini"
    if OLLAMA_BASE_URL:
        return "ollama", f"{OLLAMA_BASE_URL}/v1/chat/completions", "ollama", os.getenv("OLLAMA_MODEL","qwen2.5:3b")
    raise HTTPException(503, "No AI provider is configured yet. Add an OpenRouter, OpenAI, or Ollama setting to the server.")

async def ask_model(messages, requested_model=None):
    provider, url, key, model = provider_config(requested_model)
    headers = {"Authorization":f"Bearer {key}","Content-Type":"application/json"}
    if provider == "openrouter":
        headers["HTTP-Referer"] = "https://theveter.in"
        headers["X-Title"] = "Veter AI"
    payload = {"model":model,"messages":messages,"temperature":0.4}
    async with httpx.AsyncClient(timeout=90) as client:
        response = await client.post(url, headers=headers, json=payload)
    if response.status_code >= 400:
        detail = "The AI provider returned an error. Check the model name, provider credits and API key."
        raise HTTPException(502, detail)
    data = response.json()
    try:
        answer = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        raise HTTPException(502, "The AI provider returned an unexpected response.")
    if isinstance(answer, list):
        answer = "".join(part.get("text","") for part in answer if isinstance(part,dict))
    return str(answer), provider, model

@app.get("/health")
async def health():
    return {"ok":True,"service":"Veter AI","version":"0.1.0","providers":{"openrouter":bool(OPENROUTER_API_KEY),"openai":bool(OPENAI_API_KEY),"ollama":bool(OLLAMA_BASE_URL)}}

@app.get("/v1/models")
async def models(authorization: str = Header(default="")):
    token = authorization.removeprefix("Bearer ").strip()
    if not token: raise HTTPException(401,"Sign in required.")
    await user_from_token(token)
    return {"models":[{"id":MODEL,"label":"Veter AI · Balanced","provider":"automatic"},{"id":"openai/gpt-4o-mini","label":"Fast model","provider":"openrouter"}]}

@app.get("/v1/threads")
async def list_threads(authorization: str = Header(default="")):
    token = authorization.removeprefix("Bearer ").strip()
    if not token: raise HTTPException(401,"Sign in required.")
    user = await user_from_token(token)
    return await db_request("GET",f"ai_threads?select=id,title,model,created_at,updated_at&owner_uid=eq.{user['id']}&order=updated_at.desc&limit=50",token)

@app.get("/v1/threads/{thread_id}/messages")
async def list_messages(thread_id: str, authorization: str = Header(default="")):
    token = authorization.removeprefix("Bearer ").strip()
    if not token: raise HTTPException(401,"Sign in required.")
    user = await user_from_token(token)
    return await db_request("GET",f"ai_messages?select=id,role,content,provider,created_at&thread_id=eq.{thread_id}&owner_uid=eq.{user['id']}&order=created_at.asc&limit=100",token)

@app.post("/v1/chat")
async def chat(body: ChatInput, authorization: str = Header(default="")):
    token = authorization.removeprefix("Bearer ").strip()
    if not token: raise HTTPException(401,"Sign in required.")
    user = await user_from_token(token)
    uid = user["id"]
    thread_id = body.thread_id
    if thread_id:
        rows = await db_request("GET",f"ai_threads?select=id&id=eq.{thread_id}&owner_uid=eq.{uid}&limit=1",token)
        if not rows: raise HTTPException(404,"Conversation not found.")
    else:
        title = body.content.strip().replace("\n"," ")[:72] or "New conversation"
        created = await db_request("POST","ai_threads",token,json={"owner_uid":uid,"title":title,"model":body.model or MODEL})
        thread_id = created[0]["id"]
    history = await db_request("GET",f"ai_messages?select=role,content&thread_id=eq.{thread_id}&owner_uid=eq.{uid}&order=created_at.desc&limit=16",token)
    history = list(reversed(history or []))
    messages = [{"role":"system","content":SYSTEM_PROMPT}] + [{"role":m["role"],"content":m["content"]} for m in history] + [{"role":"user","content":body.content}]
    answer, provider, used_model = await ask_model(messages, body.model)
    await db_request("POST","ai_messages",token,json=[{"thread_id":thread_id,"owner_uid":uid,"role":"user","content":body.content,"provider":"user"},{"thread_id":thread_id,"owner_uid":uid,"role":"assistant","content":answer,"provider":provider}])
    await db_request("PATCH",f"ai_threads?id=eq.{thread_id}&owner_uid=eq.{uid}",token,json={"updated_at":datetime.now(timezone.utc).isoformat(),"model":used_model})
    return {"thread_id":thread_id,"answer":answer,"provider":provider,"model":used_model}

@app.delete("/v1/threads/{thread_id}")
async def delete_thread(thread_id: str, authorization: str = Header(default="")):
    token = authorization.removeprefix("Bearer ").strip()
    if not token: raise HTTPException(401,"Sign in required.")
    user = await user_from_token(token)
    await db_request("DELETE",f"ai_threads?id=eq.{thread_id}&owner_uid=eq.{user['id']}",token)
    return {"ok":True}
