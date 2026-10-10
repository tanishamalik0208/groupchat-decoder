# GroupChat Decoder

> Turn messy group conversations into structured, actionable intelligence.

GroupChat Decoder is an AI-powered conversation analysis platform that transforms unstructured group chats into clear summaries, action items, decisions, participant insights, timelines, and conversation health signals.

## Problem

Important information gets buried inside group chats.

People often have to manually figure out:

- What was decided?
- Who is responsible for what?
- What tasks are still pending?
- What questions remain unanswered?
- Which topics are dominating the conversation?
- Is the team actually aligned?

GroupChat Decoder converts that conversation noise into structured intelligence.

## Solution

The workflow is:

**Conversation → Decoder → Structured Intelligence → Action**

Users can paste or upload a conversation and receive a dashboard containing:

- Executive summary
- Action items
- Decisions
- People and roles
- Timeline
- Key messages
- Topics
- Unresolved questions
- Collaboration score
- Conversation health
- Risks and signals
- AI-generated insights

## Key Features

### 🧠 Conversation Intelligence
Extracts meaningful information from unstructured group conversations.

### ✅ Action Extraction
Identifies tasks, assignees, deadlines, and status.

### 📌 Decision Detection
Finds important decisions made during the conversation.

### 👥 People & Roles
Identifies active participants and their apparent responsibilities.

### 🕒 Timeline
Organizes important events and decisions chronologically.

### 📊 Conversation Health
Provides signals about alignment, unresolved issues, and collaboration quality.

### 🔎 Topic Analysis
Groups important themes discussed in the conversation.

### ⚡ Judge Demo Mode
Includes realistic demo scenarios for:

- Project Team
- Event Planning
- Hackathon Team

### 📤 Export & Sharing
Results can be copied, exported as JSON, or shared.

### 🔒 Privacy-Friendly Design
The frontend sends conversations to the FastAPI backend. By default, analysis is deterministic and runs locally on that backend. If OpenAI is enabled, conversation text is also sent to the configured OpenAI service.

## Run locally

### Backend

```powershell
cd backend
Copy-Item .env.example .env
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Open `backend/.env` to set `ALLOWED_ORIGINS`. Local deterministic analysis is the default. To enable the optional OpenAI integration, set `USE_OPENAI=true` and add your `OPENAI_API_KEY` there. Never put provider keys in frontend settings.

### Production deployment (Vercel + Render)

The deployed frontend at `https://groupchat-decoder.vercel.app` proxies `/api/*` requests to the Render API through `frontend/vercel.json`, avoiding browser cross-origin requests. In the Render backend service, set `ALLOWED_ORIGINS` to include `https://groupchat-decoder.vercel.app` (comma-separated with any other exact origins you intend to allow), then redeploy the backend. The backend defaults include this production origin when `ALLOWED_ORIGINS` is unset or blank. Do not use `*`; CORS must remain restricted to the intended frontend origins.

### Frontend

In a second terminal:

```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://127.0.0.1:5173`). `VITE_API_URL` is a non-secret API base URL and defaults to `http://127.0.0.1:8000`.

The backend `/health` endpoint reports whether optional AI mode is configured as a boolean only. The API limits chat input size, applies per-IP rate limiting, and only allows configured browser origins.

## Architecture

```text
┌─────────────────────┐
│   React Frontend    │
│                     │
│  Input / Dashboard  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│    FastAPI Backend  │
│                     │
│      /analyze       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Analysis Engine   │
│                     │
│ Summary             │
│ Actions             │
│ Decisions           │
│ People              │
│ Timeline            │
│ Topics              │
│ Signals             │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Structured JSON   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Intelligence        │
│ Dashboard            │
└─────────────────────┘