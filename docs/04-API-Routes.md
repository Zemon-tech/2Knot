# API Routes

Base URL prefix: `/api`

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
