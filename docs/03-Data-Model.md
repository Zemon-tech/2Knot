# Data Model

- **Entity Overview**
  - User
  - Conversation
  - Message
  - RefreshToken (embedded in User)

- **Relationships**
  - A User can have many Conversations.
  - A Conversation belongs to one User and has many Messages.
  - Each Message belongs to a Conversation and a User (owner).

- **Conceptual Diagram (textual)**
  User (1) — (N) Conversation (1) — (N) Message

- **User (models/User.ts)**
  - id: ObjectId
  - email: string (unique, indexed)
  - passwordHash: string
  - name: string | undefined
  - refreshTokens: [{ tokenId: string, expiresAt: Date }]
  - timestamps: createdAt, updatedAt

- **Conversation (models/Conversation.ts)**
  - id: ObjectId
  - userId: ObjectId (ref User, indexed)
  - title: string
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

- **Why we store this data**
  - Users: authentication and personalization.
  - Conversations: organize user chats and enable list/delete/rename operations.
  - Messages: persist chat history for context and audit; attach web artifacts to assistant messages for transparency.
