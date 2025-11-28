# Overview

Quild AI is a full-stack, production-ready AI chat application.

- Realtime streamed responses with phases and optional web grounding.
- Persistent conversations and messages backed by MongoDB.
- Agent system with inline `@` mentions to specialize behavior per message.
- Secure backend (JWT, rate limits, CORS, helmet) and clean React frontend.

## Project goals
- Ship a clean baseline you can fork and extend for your use case.
- Keep security and performance sensible by default.
- Provide readable, well-documented code with clear boundaries.

## High-level architecture
```
Frontend (React)  <—HTTP—>  Backend (Express/TS)  <—>  Providers (Gemini/OpenRouter/Groq)
                                                   \—>  Web Search (SerpAPI)
                                                   \—>  Storage (Supabase for images)
                                                   \—>  MongoDB (Users/Conversations/Messages/Agents)
```

- Frontend: Vite + React + TypeScript, shadcn/ui-style components, lucide icons.
- Backend: Express + TypeScript, SSE for streaming, JWT auth with refresh tokens.
- Providers: Gemini by default, optional OpenRouter and Groq via backend proxy.
- Web: SerpAPI used to fetch/search and enrich answers (optional).

## Core features
- Authentication: register, login, logout, refresh, current user.
- Conversations: list/create/delete/rename and paginated messages.
- Streaming: SSE with phases and structured events (sources, web summary).
- Agents: CRUD + `@agent` mentions inline in the composer.
- Images: basic image analysis endpoint with Supabase storage.

## Glossary
- Conversation: A thread of messages between user and assistant.
- Agent: A saved persona/prompt referenced inline via `@<slug>`.
- Provider: The LLM backend used to generate text (Gemini/OpenRouter/Groq).
- Web mode: Optional research flow that augments answers with sources.

## Roadmap (suggested)
- Pluggable tools for more actions (code run, file search, etc.).
- Team/workspace support and sharing settings.
- Observability: request tracing and metrics.
- More first-party providers and model selection presets.

## Where to next
- Quick start: README.md → Quick start
- Tech details: 02-Technical-Stack.md
- API details: 04-API-Routes.md
- Frontend guide: 08-Frontend.md
- Agents: 07-Agents-and-Mentions.md

- **Purpose**
  The backend powers Quild AI’s chat application. It provides authentication, secure user sessions, AI response streaming, optional web research augmentation, and persistent storage of conversations and messages.

- **What the app does (high level)**
  Users sign up and log in, start conversations, send messages, and receive streamed AI responses. The system can optionally run web searches to enrich answers with recent and trusted sources, and it persists chats for later retrieval.

- **Target audience / Why this app was built**
  - End users who need a reliable AI assistant with optional up-to-date web context.
  - Internal teams who need a secure, scalable backend to manage auth, data, and AI provider orchestration.
  - Stakeholders who require auditable storage of conversations and transparent use of external data sources.

- **System architecture overview**
  - Frontend ↔ Backend ↔ External Services ↔ Database
  - Frontend communicates with the backend’s REST endpoints (and receives AI output via Server-Sent Events streaming).
  - Backend orchestrates authentication, routes, AI providers (Gemini or OpenRouter), and optional SerpAPI web search.
  - Database (MongoDB via Mongoose) stores users, conversations, and messages, including attached web research metadata.

- **Non-coder explanation of stored/processed data**
  - We store user accounts (email, encrypted password, optional name).
  - Each user has multiple conversations (a conversation is like a chat thread with a title).
  - Each conversation contains messages from the user and the assistant.
  - Assistant messages can include web sources (links, titles, favicons) and a brief summary of findings when web search is enabled.
  - We never store raw passwords; only hashed values are stored.
