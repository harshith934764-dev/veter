# Veter AI setup

## What is included
- `/veter-ai.html`: responsive AI workspace and installable PWA.
- `/social.html`: entry point from Veter Social.
- `veter-ai-api/`: FastAPI service. It verifies the signed-in Veter Social Firebase/Supabase identity, routes requests to an AI provider, and stores private chat history.
- `manifest.webmanifest` and `sw.js`: installable app shell for desktop, Android and supported browsers on VeterOS.

## Deploy the API on Render
Create a Python web service from this repository:
- Region: Singapore
- Root directory: `veter-ai-api`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Health check path: `/health`

Set these server environment variables:
- `SUPABASE_URL=https://qqvfphefusvbveucqbrj.supabase.co`
- `SUPABASE_ANON_KEY`: use the active legacy anon key or publishable key for the same Supabase project.
- `OPENROUTER_API_KEY`: optional; recommended first paid/hybrid provider.
- `OPENAI_API_KEY`: optional fallback if OpenRouter is not configured.
- `OLLAMA_BASE_URL`: optional URL of a reachable OpenAI-compatible Ollama server.
- `OLLAMA_MODEL`: optional local model name (default `qwen2.5:3b`).
- `VETER_AI_MODEL`: default model identifier (default `openai/gpt-4o-mini`).
- `APP_ORIGINS=https://theveter.in,https://www.theveter.in`

Never put provider API keys in browser JavaScript or commit them to GitHub. Only set them in Render's secret environment variables.

The frontend currently expects the API at `https://veter-ai-api.onrender.com`. If Render assigns a different hostname, change the `API` constant in `assets/js/veter-ai.js` to that exact URL.

## Authentication and database
The chat schema is created in the existing Veter Social Supabase project by migration `create_veter_ai_chat`. The two chat tables use row-level security tied to the authenticated Firebase/Supabase JWT subject. Chat history is not public.

## Use it
- Website: open `https://theveter.in/veter-ai.html`.
- Veter Social: use the new **Veter AI** navigation/sidebar link.
- VeterOS / desktop: open the website in Chromium and choose **Install app** (or the browser's Install page option). On Android, use the browser's install option.

## Current limitations
This is the first working foundation, not a frontier-trained model. It needs a provider key or reachable Ollama endpoint before it can answer. Web search, image understanding, voice, file uploads, agent tools, billing and evaluation dashboards are planned follow-up modules.
