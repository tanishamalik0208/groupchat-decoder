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
The application can perform deterministic local analysis without requiring an external AI API.

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