# File Breakdown

- **src/server.ts**
  - Role: Express app bootstrap, middleware, health check, and route mounting; starts server after DB connect.
  - Key exports: none (invoked at runtime).
  - Dependencies: express, helmet, cors, cookie-parser, morgan, express-rate-limit, http-errors, config/db, config/env, routes.

- **src/routes/index.ts**
  - Role: Aggregates sub-routers under /api; exposes API root.
  - Key exports: `router`.
  - Dependencies: express.Router, ./authRoutes, ./conversationRoutes, ./aiRoutes.

- **src/routes/authRoutes.ts**
  - Role: Authentication endpoints (register, login, logout, refresh, me).
  - Key exports: `authRouter`.
  - Dependencies: express.Router, controllers/authController, middleware/auth (for `me`).

- **src/routes/conversationRoutes.ts**
  - Role: Conversation CRUD and message listing; all protected by `requireAuth`.
  - Key exports: `conversationRouter`.
  - Dependencies: express.Router, controllers/conversationController, controllers/messageController, middleware/auth.

- **src/routes/aiRoutes.ts**
  - Role: AI endpoints: stream completions and generate conversation title; protected by `requireAuth`.
  - Key exports: `aiRouter`.
  - Dependencies: express.Router, middleware/auth, controllers/aiController.

- **src/controllers/authController.ts**
  - Role: Handles registration, login, refresh, logout, current user (`me`).
  - Key functions: `register`, `login`, `refresh`, `logout`, `me`.
  - Dependencies: bcryptjs, http-errors, models/User, utils/jwt, middleware/auth types.

- **src/controllers/conversationController.ts**
  - Role: List, create, delete, update title for conversations.
  - Key functions: `listConversations`, `createConversation`, `deleteConversation`, `updateConversationTitle`.
  - Dependencies: http-errors, models/Conversation, models/Message, middleware/auth types.

- **src/controllers/messageController.ts**
  - Role: Paginated retrieval of conversation messages.
  - Key functions: `getConversationMessages`.
  - Dependencies: http-errors, models/Conversation, models/Message, middleware/auth types.

- **src/controllers/aiController.ts**
  - Role: Core AI flow, streaming responses, optional web search, and title generation.
  - Key functions: `streamAIResponse`, `generateConversationTitle`.
  - Dependencies: express types, fs/path, http-errors, middleware/auth types, models/Conversation & Message, config/env, @ai-sdk/openai, ai (streamText/generateText), services/serpapi, ai/openrouterProvider.

- **src/middleware/auth.ts**
  - Role: Auth guard to require a valid access token; attaches `req.user`.
  - Key exports: `requireAuth`, type `AuthenticatedRequest`.
  - Dependencies: http-errors, utils/jwt.

- **src/models/User.ts**
  - Role: User schema with email, passwordHash, optional name, and embedded refresh tokens.
  - Key exports: `UserModel`, `UserDocument` type.
  - Dependencies: mongoose Schema/InferSchemaType.

- **src/models/Conversation.ts**
  - Role: Conversation schema with userId and title; timestamped; indexed for recency.
  - Key exports: `ConversationModel`, `ConversationDocument` type.
  - Dependencies: mongoose Schema/InferSchemaType.

- **src/models/Message.ts**
  - Role: Message schema linking to conversation and user with role/content; supports attached web sources/summary.
  - Key exports: `MessageModel`, `MessageDocument` type.
  - Dependencies: mongoose Schema/InferSchemaType.

- **src/config/db.ts**
  - Role: Connect to MongoDB with strictQuery and env URI.
  - Key exports: `connectToDatabase`.
  - Dependencies: mongoose, config/env.

- **src/config/env.ts**
  - Role: Load environment variables and enforce required ones; expose `env` object.
  - Key exports: `env`.
  - Dependencies: dotenv.

- **src/utils/jwt.ts**
  - Role: JWT sign/verify utilities and token id generation.
  - Key exports: `signAccessToken`, `signRefreshToken`, `verifyAccessToken`, `verifyRefreshToken`, `generateTokenId`.
  - Dependencies: jsonwebtoken, crypto, config/env.

- **src/services/serpapi.ts**
  - Role: Lightweight wrapper around SerpAPI and safe content fetching for RAG.
  - Key exports: `serpGoogleLightSearch`, `serpGoogleNewsLightSearch`, `serpSearch`, `renderCitations`, `fetchMainText`, `fetchTopArticlesText`, types.
  - Dependencies: config/env, timers/promises, global fetch.

- **src/ai/openrouterProvider.ts**
  - Role: Factory for OpenAI-compatible client configured for OpenRouter.
  - Key exports: `createOpenRouterClient`, `getOpenRouterModelId`.
  - Dependencies: @ai-sdk/openai, config/env.

- **src/prompts/** (system.md, websynthesis.md, websearch.md)
  - Role: Prompt templates for system behavior, web synthesis, and web search query optimization. Loaded with file-system fallbacks.
  - Key exports: n/a (assets read at runtime).
