# Technical Stack

- **Core Technology**
  - Runtime: Node.js (TypeScript)
  - Framework: Express
  - Database: MongoDB via Mongoose
  - Env management: dotenv

- **Versions (from package.json)**
  - express ^4.19.2
  - mongoose ^8.6.0
  - jsonwebtoken ^9.0.2
  - bcryptjs ^2.4.3
  - cors ^2.8.5
  - helmet ^7.1.0
  - express-rate-limit ^7.4.0
  - morgan ^1.10.0
  - dotenv ^16.4.5
  - ai ^5.0.87
  - @ai-sdk/openai ^2.0.62
  - @ai-sdk/google ^1.2.22
  - zod ^3.23.8, joi ^17.12.0 (validation utilities)

- **Database**
  - Type: MongoDB
  - Library: Mongoose
  - Primary use: Persistent storage for users, conversations, and messages (including web research metadata on assistant messages).

- **External APIs/Services**
  - Google Gemini (via OpenAI-compatible endpoint baseURL): model for LLM generation and streaming.
  - OpenRouter (optional): alternative multi-model provider via OpenAI-compatible SDK.
  - SerpAPI (optional): fetches Google/News search results to ground answers with current information.

- **Dependencies and Purpose**
  | Package | Purpose | Role |
  | --- | --- | --- |
  | express | Web framework | Routing, middleware, HTTP handling |
  | mongoose | ODM | MongoDB connection and schemas |
  | jsonwebtoken | JWT | Sign/verify access and refresh tokens |
  | bcryptjs | Crypto | Password hashing and verification |
  | cors | Middleware | Cross-origin resource sharing config |
  | helmet | Middleware | Security headers |
  | express-rate-limit | Middleware | Throttling requests |
  | morgan | Middleware | HTTP request logging |
  | cookie-parser | Middleware | Read/write cookies for tokens |
  | dotenv | Config | Load env variables |
  | ai | LLM client | streamText/generateText abstractions |
  | @ai-sdk/openai | Provider SDK | OpenAI-compatible client (also used for OpenRouter & Gemini OpenAI-compat) |
  | @ai-sdk/google | Provider SDK | Google models integration |
  | zod, joi | Validation | Data validation (utilities) |

- **Environment variables (from src/config/env.ts)**
  - MONGODB_URI
  - JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
  - CLIENT_ORIGIN
  - GEMINI_API_KEY
  - AI_PROVIDER (gemini|openrouter)
  - OPENROUTER_API_KEY, OPENROUTER_MODEL, OPENROUTER_REFERER, OPENROUTER_TITLE
  - SERPAPI_KEY
  - GROQ_API_KEY, GROQ_MODEL
  - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_BUCKET
  - ADK_AGENT_URL, ADK_TIMEOUT, ADK_RETRY_ATTEMPTS, ADK_RETRY_DELAY

## Environment variables (detailed)

| Name | Required | Example | Notes |
| --- | --- | --- | --- |
| MONGODB_URI | yes | mongodb+srv://... | Mongo connection string |
| JWT_ACCESS_SECRET | yes | long-random-string | Signs access tokens |
| JWT_REFRESH_SECRET | yes | long-random-string | Signs refresh tokens |
| CLIENT_ORIGIN | yes | http://localhost:5173 | CORS origin for frontend |
| GEMINI_API_KEY | yes (default provider) | `...` | Required when `AI_PROVIDER=gemini` |
| AI_PROVIDER | no | gemini | gemini | openrouter | groq |
| OPENROUTER_API_KEY | when using OpenRouter | `...` | Optional otherwise |
| OPENROUTER_MODEL | no | openrouter/auto | Preferred model id |
| OPENROUTER_REFERER | no | https://your.app | For OpenRouter policy |
| OPENROUTER_TITLE | no | Quild AI | Shown in OpenRouter logs |
| GROQ_API_KEY | when using Groq | `...` | Optional otherwise |
| GROQ_MODEL | no | llama-3.3-70b-versatile | Default Groq model |
| SERPAPI_KEY | when enabling web search | `...` | Optional otherwise |
| SUPABASE_URL | yes | https://<ref>.supabase.co | Images storage |
| SUPABASE_SERVICE_ROLE_KEY | yes | `...` | Server-side key |
| SUPABASE_BUCKET | yes | quild-images | Bucket name |
| ADK_AGENT_URL | no | http://localhost:8000 | Base URL for Google ADK service |
| ADK_TIMEOUT | no | 30000 | Request timeout (ms) for ADK calls |
| ADK_RETRY_ATTEMPTS | no | 3 | Retry attempts for ADK calls |
| ADK_RETRY_DELAY | no | 1000 | Initial retry backoff (ms) |

### Frontend env keys

| Name | Required | Example | Notes |
| --- | --- | --- | --- |
| VITE_API_BASE | yes (in dev) | http://localhost:4000/api | Backend API base for fetch() |
| REACT_APP_SUPABASE_URL | when using images | https://<ref>.supabase.co | Supabase URL |
| REACT_APP_SUPABASE_ANON_KEY | when using images | `...` | Public anon key for client uploads |
| VITE_SUPABASE_BUCKET | when using images | attachments | Bucket name used client-side |

## Rationale & alternatives

- Express + TypeScript: mature, minimal overhead; alternatives: Fastify, NestJS.
- MongoDB via Mongoose: schemaless iteration speed; alternatives: Postgres + Prisma.
- ai + provider SDKs: unified streaming and provider swap; alternatives: direct REST.
- SerpAPI: simple Google/News results; alternatives: Tavily, Perplexity API, Bing.

## External resources

- Express docs: https://expressjs.com/
- Mongoose docs: https://mongoosejs.com/
- ai SDK: https://github.com/vercel/ai
- OpenRouter: https://openrouter.ai/
- Groq: https://groq.com/
- SerpAPI: https://serpapi.com/
