# API Routes

Base URL: `http://localhost:4000/api`

Auth is required for all routes below unless noted.

## Auth

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| POST | /auth/register | `{ email, password, name? }` | Creates a new user |
| POST | /auth/login | `{ email, password }` | Issues cookies (access/refresh) |
| POST | /auth/logout | — | Clears cookies |
| POST | /auth/refresh | — | Refreshes access token |
| GET | /auth/me | — | Returns current user |

Example:
```bash
curl -X POST http://localhost:4000/api/auth/login \
 -H 'Content-Type: application/json' \
 -c cookies.txt -b cookies.txt \
 -d '{"email":"dev@example.com","password":"secret"}'
```

## Conversations

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| GET | /conversations | — | List conversations |
| POST | /conversations | `{ title? }` | Create conversation |
| DELETE | /conversations/:id | — | Delete |
| PATCH | /conversations/:id/title | `{ title }` | Rename |
| GET | /conversations/:id/messages | query: `page,pageSize` | List messages |

## Agents

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| GET | /agents | — | List agents |
| POST | /agents | `{ name, description?, systemPrompt }` | Create agent |
| PATCH | /agents/:id | `{ name?, description?, systemPrompt? }` | Update |
| DELETE | /agents/:id | — | Delete |

## AI

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| POST | /ai/stream | `{ conversationId?, message, attachments?, provider?, webSearch?, web?, agentId? }` | SSE stream |
| POST | /ai/title | `{ conversationId, provider? }` | Generate title |
| GET | /ai/models/openrouter | — | OpenRouter models via backend |
| GET | /ai/models/groq | — | Groq models via backend |

SSE example:
```bash
curl -N -X POST http://localhost:4000/api/ai/stream \
 -H 'Content-Type: application/json' \
 -c cookies.txt -b cookies.txt \
 -d '{"message":"Explain RAG","provider":"gemini","webSearch":false}'
```

Events include:
- `{"type":"delta","delta":"..."}`
- `{"type":"status","phase":"planning|searching|fetching|summarizing|answering|complete"}`
- `{"type":"sources","sources":[...]}`
- `{"type":"webSummary","summary":"..."}`
- `{"type":"done","conversationId":"..."}`

## Image

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| POST | /ai/image/analyze | `{ prompt, images:[{url, mediaType?, filename?}], conversationId? }` | Analyze images |
| GET | /ai/image/list | — | List user images |
| DELETE | /ai/image?url=... | — | Delete by URL |

## Errors

- Non-2xx returns `{ error: string }`.
- 401 Unauthorized triggers client refresh flow; see `frontend/src/api/client.ts`.

## Security

- Rate limiting enabled globally (120 req/min). See `src/server.ts`.
- CORS restricted via `CLIENT_ORIGIN` env.
- Cookies used for auth; secure flags recommended in production behind HTTPS.

- **Health**
  | Method | Path | Purpose | Auth |
  | --- | --- | --- | --- |
  | GET | /health | Liveness check | None |

- **Auth**
  | Method | Path | Purpose | Request | Response | Auth |
  | --- | --- | --- | --- | --- | --- |
  | POST | /api/auth/register | Create user account | { email, password, name? } | { user: { id, email, name } } | None |
  | POST | /api/auth/login | Log in and set cookies | { email, password } | { user: { id, email, name } } | None |
  | POST | /api/auth/logout | Log out and clear cookies | none | { ok: true } | None |
  | POST | /api/auth/refresh | Issue new access token cookie | Cookie: refresh_token | { ok: true } | None |
  | GET | /api/auth/me | Get current user | Bearer or access_token cookie | { user: { id, email, name } } | Required |

- **Conversations** (require auth)
  | Method | Path | Purpose | Request | Response |
  | --- | --- | --- | --- | --- |
  | GET | /api/conversations | List user conversations | none | { conversations: Conversation[] }
  | POST | /api/conversations | Create conversation | { title? } | { conversation }
  | GET | /api/conversations/:id/messages | Paginated messages | Query: page?, pageSize? | { messages: Message[] }
  | DELETE | /api/conversations/:id | Delete conversation and its messages | none | { ok: true }
  | PATCH | /api/conversations/:id/title | Update title | { title } | { conversation }

- **AI** (require auth)
  | Method | Path | Purpose | Request | Streaming Response |
  | --- | --- | --- | --- | --- |
  | POST | /api/ai/stream | Stream AI completion, optionally with web search | { conversationId?, message, webSearch?, provider?, web?{gl?,hl?,location?,num?,maxSources?} } | Server-Sent Events: see below |
  | POST | /api/ai/title | Generate concise conversation title | { conversationId, provider? } | { title }

- **SSE event format (/api/ai/stream)**
  - Content-Type: text/event-stream
  - Events emitted as JSON in `data:` lines
  - Types:
    - { type: 'status', phase: 'planning'|'searching'|'fetching'|'summarizing'|'answering'|'complete' }
    - { type: 'delta', delta: string }
    - { type: 'sources', sources: [{ id, title, link, source?, favicon?, date?, snippet? }] }
    - { type: 'webSummary', summary: string }
    - { type: 'error', message: string }
    - { type: 'done', conversationId }

- **Auth mechanism**
  - Access token: Bearer token or `access_token` cookie; validated by middleware `requireAuth`.
  - Refresh token: `refresh_token` httpOnly cookie; rotated/validated in refresh/logout flows.
