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
