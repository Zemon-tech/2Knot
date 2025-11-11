# Core Logic

- **AI Provider Selection**
  - Default provider from `env.AI_PROVIDER` ('gemini' by default).
  - Gemini: uses OpenAI-compatible baseURL for Google models; key `GEMINI_API_KEY`.
  - OpenRouter: created via `createOpenRouterClient` with headers and `OPENROUTER_API_KEY`.

- **Streaming Implementation (SSE)**
  - Endpoint: POST /api/ai/stream
  - Sets headers: Content-Type text/event-stream, no-cache, keep-alive.
  - Uses `ai.streamText` to iterate `response.textStream` and emit `delta` chunks.
  - Emits status phases during web search: planning → searching → fetching → summarizing → answering → complete.
  - After stream, persists assistant message with any sources/webSummary/researchBrief and emits final `sources`, optional `webSummary`, then `done` with conversationId.

- **Conversation context management**
  - Fetches entire conversation history for the user/conversation.
  - Trims to a character budget and max turns depending on provider to control token usage.

- **Web Search / RAG Flow** (when `webSearch=true` and `SERPAPI_KEY` is set)
  1. Plan multiple search queries with `generateText` (structured JSON). Fallback to a single query using `WEBSEARCH_PROMPT`.
  2. Determine intent (news vs general) from user message to choose engine and time bias.
  3. Normalize queries for recency (e.g., add current month/year), honor locale options (gl, hl, location) and num.
  4. Execute searches via `serpGoogleLightSearch` or `serpGoogleNewsLightSearch` (SerpAPI).
  5. Deduplicate results by host+path and limit per-domain; select top N.
  6. Optionally fetch and extract main content from top articles (`fetchTopArticlesText`) with safe HTML stripping.
  7. Build a compact research brief summarizing sources and extracted content; cap length for OpenRouter.
  8. Construct final system prompt from: base SYSTEM_PROMPT + current context (time/locale) + synthesized prompt + research brief.
  9. Stream model output; at the end, emit `sources` event so the UI can render source pills.

- **Authentication & Authorization**
  - JWT access tokens (15m) and refresh tokens (30d) via `utils/jwt.ts`.
  - Access tokens verified in `middleware/auth.requireAuth`; token sent as Bearer or `access_token` cookie.
  - Refresh flow (`/api/auth/refresh`) validates `refresh_token` cookie against user’s stored `refreshTokens` array and issues a new access token cookie.
  - Logout removes refresh token id from DB and clears cookies.
  - Protected routes: `/api/conversations/*`, `/api/ai/*`, and `/api/auth/me`.

- **Security & Ops**
  - `helmet`, `cors` with configured `CLIENT_ORIGIN`, `express-rate-limit`, `morgan`.
  - Centralized error handling with http-errors.
  - Mongo connection via `connectToDatabase` with strictQuery.
