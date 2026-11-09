"""VETER Core inference adapter with an Ollama-compatible /api/chat route.

Set VETER_RUNTIME_TOKEN before starting. This protects the model endpoint from
unauthorized use. This first checkpoint is an experimental text generator,
not an instruction-tuned assistant.
"""
from __future__ import annotations

import hmac
import os
from datetime import datetime, timezone
from typing import Literal

import torch
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from tokenizers import Tokenizer

from config import VETERConfig
from model import VETERCore

CHECKPOINT = os.getenv("VETER_CHECKPOINT", "artifacts/checkpoints/veter-core-step-500.pt")
TOKENIZER_PATH = os.getenv("VETER_TOKENIZER", "artifacts/tokenizer.json")
RUNTIME_TOKEN = os.getenv("VETER_RUNTIME_TOKEN", "")
MODEL_NAME = os.getenv("VETER_MODEL_NAME", "veter-core")
MAX_NEW_TOKENS = int(os.getenv("VETER_MAX_NEW_TOKENS", "80"))
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

if not RUNTIME_TOKEN:
    raise RuntimeError("Set VETER_RUNTIME_TOKEN to a long random secret before starting the runtime.")

checkpoint = torch.load(CHECKPOINT, map_location=DEVICE, weights_only=False)
config = VETERConfig(**checkpoint["config"])
model = VETERCore(config).to(DEVICE)
model.load_state_dict(checkpoint["model"])
model.eval()
tokenizer = Tokenizer.from_file(TOKENIZER_PATH)

app = FastAPI(title="VETER Core Runtime", version="0.1.0")


def require_runtime_token(authorization: str | None = Header(default=None)):
    expected = f"Bearer {RUNTIME_TOKEN}"
    if not authorization or not hmac.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="Unauthorized runtime request.")


class Message(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1, max_length=12000)


class ChatRequest(BaseModel):
    model: str = MODEL_NAME
    messages: list[Message] = Field(min_length=1, max_length=20)
    stream: bool = False


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_NAME, "device": DEVICE}


@app.post("/api/chat", dependencies=[Depends(require_runtime_token)])
def chat(payload: ChatRequest):
    # This checkpoint was trained on TinyStories, not dialogue. The wrapper
    # provides protocol compatibility only; it does not make the model chat-trained.
    latest_user = next((m.content for m in reversed(payload.messages) if m.role == "user"), "")
    if not latest_user:
        raise HTTPException(status_code=400, detail="A user message is required.")

    prompt = f"User: {latest_user}\nAssistant:"
    ids = tokenizer.encode(prompt).ids or [0]
    input_ids = torch.tensor([ids], dtype=torch.long, device=DEVICE)
    with torch.inference_mode():
        generated = model.generate(
            input_ids,
            max_new_tokens=max(1, min(MAX_NEW_TOKENS, 120)),
            temperature=0.8,
            top_k=40,
        )
    full_text = tokenizer.decode(generated[0].tolist(), skip_special_tokens=True)
    answer = full_text[len(tokenizer.decode(ids, skip_special_tokens=True)):].strip()
    if not answer:
        answer = tokenizer.decode(generated[0, len(ids):].tolist(), skip_special_tokens=True).strip()
    return {
        "model": payload.model or MODEL_NAME,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "message": {"role": "assistant", "content": answer},
        "done": True,
    }
