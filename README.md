<p align="center">
  <img src="docs/images/2%20Knot.png" alt="Quild AI Cover" width="100%" />
</p>

<div align="center">

# Quild AI

Clean, fast, and secure AI chat application (backend + frontend). Supports streamed answers, optional web-augmented responses, persistent chat history, and a flexible agent system with inline @-mentions.

</div>

## UI Preview

<div align="center">

<table>
  <tr>
    <td align="center">
      <img src="docs/images/auth.png" alt="Auth Page" width="360" />
      <div><b>Auth</b></div>
    </td>
    <td align="center">
      <img src="docs/images/app-1.png" alt="Main App - View 1" width="360" />
      <div><b>Main App (1)</b></div>
    </td>
    <td align="center">
      <img src="docs/images/app-2.png" alt="Main App - View 2" width="360" />
      <div><b>Main App (2)</b></div>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="docs/images/model-selector.png" alt="Model Selector" width="360" />
      <div><b>Model Selector</b></div>
    </td>
    <td align="center">
      <img src="docs/images/settings.png" alt="Settings" width="360" />
      <div><b>Settings</b></div>
    </td>
  </tr>
</table>

</div>

## Why this project

- Build production-ready AI chat with security, speed, and clean architecture.
- Stream responses in real time and optionally ground them with fresh web results.
- Keep conversations and messages persisted for continuity and auditability.

## Repository layout

```
quild.ai/
├─ backend/                 # Express + TypeScript API server
│  ├─ src/
│  │  ├─ config/           # env, db
│  │  ├─ middleware/       # auth
│  │  ├─ models/           # User, Conversation, Message, Agent
│  │  ├─ routes/           # auth, conversations, ai, agents
│  │  ├─ controllers/      # request handlers
│  │  └─ ai/, services/, utils/
│  └─ package.json
├─ frontend/               # React + TypeScript (Vite) app
│  ├─ src/
│  │  ├─ api/              # API client
│  │  ├─ components/       # ui/ + ai-elements/
│  │  └─ pages/            # Chat page, etc.
│  └─ package.json
└─ docs/                   # Project documentation and images
```

## Quick start

1) Set environment variables (see Docs → Technical Stack → Env Vars)
2) Install deps in each app (root/frontend/backend)
3) Run backend and frontend in dev mode

```bash
# backend
npm install --prefix backend
npm run dev --prefix backend

# frontend
npm install --prefix frontend
npm run dev --prefix frontend
```

## Documentation (start here)

Everything you need is one click away:

- 01 — Overview → [docs/01-Overview.md](docs/01-Overview.md)
- 02 — Technical Stack → [docs/02-Technical-Stack.md](docs/02-Technical-Stack.md)
- 03 — Data Model → [docs/03-Data-Model.md](docs/03-Data-Model.md)
- 04 — API Routes → [docs/04-API-Routes.md](docs/04-API-Routes.md)
- 05 — Core Logic → [docs/05-Core-Logic.md](docs/05-Core-Logic.md)
- 06 — File Breakdown → [docs/06-File-Breakdown.md](docs/06-File-Breakdown.md)
- 07 — Agents & Mentions → [docs/07-Agents-and-Mentions.md](docs/07-Agents-and-Mentions.md)
- 08 — Frontend Guide → [docs/08-Frontend.md](docs/08-Frontend.md)
- 09 — Deployment → [docs/09-Deployment.md](docs/09-Deployment.md)

## Architecture at a glance

- Frontend ↔ Backend ↔ External Services ↔ MongoDB
- Backend: Express + TypeScript, JWT auth (access/refresh), SSE streaming.
- AI Providers: Gemini (default) with optional OpenRouter and Groq (proxied via backend).
- Web augmentation: SerpAPI (optional) for search + summarization.

## Features

- Auth: register, login, refresh, logout, current user.
- Conversations: list, create, delete, rename.
- Messages: paginated retrieval per conversation.
- Agents: create, list, update, delete. Activate via inline `@agent` mentions.
- AI streaming: SSE with phases (planning/searching/fetching/summarizing/answering) and sources/web-summary events.
- Optional web mode: toggle in composer, shows a clickable pill like the agent pill.

## Tech stack

- Node.js, TypeScript, Express, Mongoose (MongoDB)
- JWT (jsonwebtoken), bcryptjs, helmet, cors, rate limiting, morgan
- ai, @ai-sdk/google, @ai-sdk/openai
- Optional: OpenRouter, Groq (via backend), SerpAPI for web augmentation

## Environment

See docs/02-Technical-Stack.md for full list and explanations. Required highlights (from backend/src/config/env.ts):

- MONGODB_URI
- JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
- CLIENT_ORIGIN (e.g., http://localhost:5173)
- GEMINI_API_KEY
- Optional: AI_PROVIDER (gemini|openrouter|groq)
- Optional: OPENROUTER_API_KEY, OPENROUTER_MODEL, OPENROUTER_REFERER, OPENROUTER_TITLE
- Optional: GROQ_API_KEY, GROQ_MODEL
- Optional: SERPAPI_KEY

## Scripts

```bash
# backend
npm run dev --prefix backend     # ts-node-dev
npm run build --prefix backend   # tsc build
npm run start --prefix backend   # run dist
```

## API overview

Backend routes (selected):

- `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `POST /auth/refresh`, `GET /auth/me`
- `GET /conversations`, `POST /conversations`, `DELETE /conversations/:id`, `PATCH /conversations/:id/title`, `GET /conversations/:id/messages`
- `GET /agents`, `POST /agents`, `PATCH /agents/:id`, `DELETE /agents/:id`
- `POST /ai/stream` (SSE), `POST /ai/title`, `GET /ai/models/openrouter`, `GET /ai/models/groq`
- `POST /ai/image/analyze`, `GET /ai/image/list`, `DELETE /ai/image`

See [docs/04-API-Routes.md](docs/04-API-Routes.md) for details.

## Frontend highlights

- Chat UI with:
  - Model selector dialog
  - Composer with attachments and @-mention agents
  - Websearch and Agent pills (click to toggle/clear)
  - Streaming responses with phases, sources, and web summary
- Tech: React + TypeScript (Vite), shadcn/ui-style components, lucide icons, Tailwind-like utilities.

More in [docs/08-Frontend.md](docs/08-Frontend.md) and [docs/07-Agents-and-Mentions.md](docs/07-Agents-and-Mentions.md).

## Contributing

- Read the docs above, follow the API contracts, and keep types tight.
- When adding routes or data, update: 03-Data-Model, 04-API-Routes, 06-File-Breakdown.
- Please ensure any new env vars are reflected in docs/02-Technical-Stack.md and README.

— Happy shipping!
