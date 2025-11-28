# Data Model

- **Entity Overview**
  - User
  - Conversation
  - Message
  - Agent
  - RefreshToken (embedded in User)

- **Relationships**
  - A User can have many Conversations.
  - A Conversation belongs to one User and has many Messages.
  - Each Message belongs to a Conversation and a User (owner).
  - A User can have many Agents; a Conversation may reference an Agent (optional).

- **Conceptual Diagram (textual)**
  User (1) — (N) Conversation (1) — (N) Message

- **User (models/User.ts)**
  - id: ObjectId
  - email: string (unique, indexed)
  - passwordHash: string
  - name: string | undefined
  - refreshTokens: [{ tokenId: string, expiresAt: Date }]
  - timestamps: createdAt, updatedAt
  - indexes: { email: 1 }

- **Conversation (models/Conversation.ts)**
  - id: ObjectId
  - userId: ObjectId (ref User, indexed)
  - title: string
  - agentId?: ObjectId (ref Agent)
  - timestamps: createdAt, updatedAt
  - indexes: { userId: 1, createdAt: -1 }

- **Message (models/Message.ts)**
  - id: ObjectId
  - conversationId: ObjectId (ref Conversation, indexed)
  - userId: ObjectId (ref User, indexed)
  - role: 'user' | 'assistant'
  - content: string
  - sources: [{ id?: number, title?: string, link?: string, source?: string, favicon?: string, date?: string, snippet?: string }]
  - webSummary?: string
  - researchBrief?: string
  - timestamps: createdAt, updatedAt
  - indexes: { conversationId: 1, createdAt: 1 }

- **Agent (models/Agent.ts)**
  - id: ObjectId
  - userId: ObjectId (ref User, indexed)
  - name: string
  - slug: string (unique per user)
  - description?: string
  - systemPrompt: string
  - timestamps: createdAt, updatedAt
  - indexes: { userId: 1, slug: 1 }

- **Why we store this data**
  - Users: authentication and personalization.
  - Conversations: organize user chats and enable list/delete/rename operations.
  - Messages: persist chat history for context and audit; attach web artifacts to assistant messages for transparency.
  - Agents: reusable personas/tools referenced inline via mentions and by conversations.

## Sample documents

```jsonc
// users
{
  "_id": "66fd...",
  "email": "dev@example.com",
  "passwordHash": "$2b$10$...",
  "name": "Dev",
  "refreshTokens": [{ "tokenId": "abc", "expiresAt": "2026-01-01T00:00:00Z" }]
}

// agents
{
  "_id": "66fe...",
  "userId": "66fd...",
  "name": "Research Agent",
  "slug": "research-agent",
  "description": "Find and summarize web sources",
  "systemPrompt": "You are a research assistant..."
}

// conversations
{
  "_id": "6700...",
  "userId": "66fd...",
  "title": "Explain transformers",
  "agentId": "66fe...",
  "createdAt": "2025-11-28T12:00:00Z"
}

// messages
{
  "_id": "6701...",
  "conversationId": "6700...",
  "userId": "66fd...",
  "role": "assistant",
  "content": "Transformers are...",
  "sources": [{ "id": 1, "title": "Paper", "link": "https://..." }],
  "webSummary": "Key findings..."
}
```
