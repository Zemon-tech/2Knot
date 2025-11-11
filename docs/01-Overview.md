# Overview

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
