# Frontend Guide

This document explains the frontend app structure, key components, state/UX patterns, and useful commands.

## Stack
- Vite + React + TypeScript
- Utility-first styling (Tailwind-like classes) and shadcn/ui-style primitives in `components/ui`
- lucide-react icons

## App structure (selected)
```
frontend/src/
├─ api/
│  └─ client.ts               # API wrapper used across the app
├─ components/
│  ├─ ai-elements/            # Chat-specific UI elements
│  │  ├─ prompt-input.tsx     # Composer (attachments, actions, text area)
│  │  ├─ model-selector.tsx   # Model selector dialog and list
│  │  ├─ message.tsx          # Message bubble
│  │  ├─ response.tsx         # Assistant markdown rendering
│  │  └─ ...
│  ├─ agents/
│  │  └─ CreateAgentDialog.tsx
│  └─ ui/                     # Generic UI primitives
│     ├─ input-group.tsx      # Input group and addons
│     ├─ button.tsx, input.tsx, dialog.tsx, ...
│     └─ ...
├─ context/
│  └─ AuthContext.tsx         # Auth state (me, login/logout)
├─ pages/
│  └─ Chat.tsx                # Main chat screen
└─ main.tsx / App.tsx         # App shell and routing
```

## Key flows
- Composer (`prompt-input.tsx`)
  - Handles attachments, drop/paste, autosize, action menu, and submit.
  - `PromptInputTextarea` supports `onMentionQueryChange` and `onMentionRemoved`.
- Agents & mentions
  - Typing `@` opens a compact agent list (in Chat).
  - Selecting inserts `@<slug>` at caret and sets the active agent (pill below input).
  - Backspace anywhere inside the token removes the full mention and clears pill.
- Websearch pill
  - Toggle via action menu; pill mirrors agent pill styling; click to deactivate.
- Streaming
  - `api.ai.stream()` pushes deltas, phases, sources, web summary via SSE.

## API client
`src/api/client.ts` exposes typed helpers for auth, conversations, agents, and AI endpoints. It also retries the SSE call on 401 by calling `auth.refresh()`.

## Commands
```bash
# dev
npm run dev --prefix frontend

# build preview
npm run build --prefix frontend
npm run preview --prefix frontend
```

## Dev tips
- Keep message rendering lightweight; sanitize or remove provider-internal fenced blocks.
- Prefer small, focused components under `ai-elements/`.
- Store ephemeral UI state locally; persist only what must survive reloads (e.g., provider choice) to localStorage.
