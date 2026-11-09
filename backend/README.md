# VETER AI API

VETER's own API layer and model-runtime adapter.

## Run locally

```bash
cd backend
python -m venv .venv
# activate the environment, then:
pip install -r requirements.txt
set FIREBASE_PROJECT_ID=veter-social
set VETER_MODEL_URL=http://127.0.0.1:11434
set VETER_MODEL_NAME=veter-core
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

The model adapter expects an Ollama-compatible `/api/chat` endpoint. The API does not call Gemini or OpenAI. A VETER-trained model can replace the runtime later without changing the website API.

## Render

Build command: `pip install -r backend/requirements.txt`

Start command: `uvicorn main:app --app-dir backend --host 0.0.0.0 --port $PORT`

Set `VETER_MODEL_URL` to a privately reachable Ollama-compatible VETER model runtime and `VETER_MODEL_NAME` to its model name. Until then, `/health` works and chat returns a clear 503 instead of pretending to generate answers.

## Prototype limitations

Conversation storage is currently in memory and resets when the service restarts. Configure durable storage before production.
