# Google ADK Agent Integration Plan

## Executive Summary

This document outlines a comprehensive plan to integrate Google ADK (Agent Development Kit) agents into the existing 2Knot chat interface. The integration will allow users to type `@agents` to discover and select ADK agents running on `localhost:8000`, with messages routed to the selected ADK agent through a new backend endpoint. The solution maintains conversation continuity by storing ADK agent messages in the same conversation model.

---

## 1. Architecture Overview

### 1.1 System Components

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Frontend      │────────▶│  Express Backend │────────▶│  Google ADK     │
│  (React/TS)     │  HTTP   │   (Node.js/TS)   │  HTTP   │  Agent (8000)   │
│  Port: 5173     │◀────────│   Port: 4000     │◀────────│  localhost:8000 │
└─────────────────┘         └──────────────────┘         └─────────────────┘
```

### 1.2 Key Integration Points

1. **Mention System Enhancement**: Extend existing `@` mention system to detect `@agents` and show ADK agent list
2. **ADK Service Layer**: New backend service to communicate with ADK agent on `localhost:8000`
3. **New API Endpoint**: `/api/adk/message` for sending messages to ADK agents
4. **Agent Discovery**: `/api/adk/agents` endpoint to list available ADK agents
5. **Session Management**: Per-message session handling (not persistent across messages)
6. **Message Storage**: Store ADK agent messages in existing conversation model

### 1.3 Communication Flow

1. **User types `@agents`** → Frontend detects special mention trigger
2. **Frontend → Backend** → GET `/api/adk/agents` to fetch available ADK agents
3. **Backend → ADK Agent** → GET `http://localhost:8000/list-apps`
4. **ADK Agent → Backend** → Returns list of available agents
5. **Backend → Frontend** → Returns agent list
6. **Frontend** → Displays ADK agents in mention dropdown
7. **User selects ADK agent** → Frontend stores selected ADK agent for current message
8. **User sends message** → Frontend detects ADK agent selection
9. **Frontend → Backend** → POST `/api/adk/message` with message and selected agent
10. **Backend → ADK Agent** → POST `http://localhost:8000/run` with formatted request
11. **ADK Agent → Backend** → Returns agent response
12. **Backend → Frontend** → Returns formatted response
13. **Frontend** → Displays response in chat interface
14. **Next message without ADK agent** → Routes back to regular AI model (`/api/ai/stream`)

---

## 2. Google ADK Agent API Specifications

### 2.1 Key Endpoints (from reference doc)

#### 2.1.1 List Available Agents
- **Endpoint**: `GET http://localhost:8000/list-apps`
- **Purpose**: Discover available agent applications
- **Response**: `["agent_name_1", "agent_name_2", ...]`

#### 2.1.2 Send Chat Message
- **Endpoint**: `POST http://localhost:8000/run`
- **Purpose**: Send messages to the agent and receive responses
- **Request Body Format**:
```json
{
  "appName": "your_agent_name",
  "userId": "user_identifier",
  "sessionId": "session_identifier",
  "newMessage": {
    "parts": [
      {
        "text": "User's message text"
      }
    ],
    "role": "user"
  },
  "stateDelta": {}
}
```

#### 2.1.3 Session Management
- **Endpoint**: `PATCH http://localhost:8000/apps/{agent_name}/users/{user_id}/sessions/{session_id}`
- **Purpose**: Update session state (optional, for future use)

### 2.2 Important Notes
- ADK uses FastAPI internally
- Interactive API docs available at `http://localhost:8000/docs` when agent is running
- Session management is per-message (not persistent across messages per user requirement)
- Response format needs to be verified during implementation

---

## 3. Backend Implementation Plan

### 3.1 Project Structure Additions

```
backend/
├── src/
│   ├── services/
│   │   └── adk.service.ts          # NEW: ADK agent communication service
│   ├── controllers/
│   │   └── adkController.ts      # NEW: ADK-related controllers
│   ├── routes/
│   │   └── adkRoutes.ts            # NEW: ADK API routes
│   ├── types/
│   │   └── adk.types.ts           # NEW: ADK API type definitions
│   └── config/
│       └── env.ts                 # UPDATE: Add ADK configuration
```

### 3.2 Core Features to Implement

#### 3.2.1 API Routes

**ADK Routes** (`/api/adk/*`)
- `GET /api/adk/agents` - List all available ADK agents (HIGH PRIORITY)
- `POST /api/adk/message` - Send message to selected ADK agent (HIGH PRIORITY)
- `GET /api/adk/health` - Check ADK agent connectivity (optional, for Phase 2)

#### 3.2.2 ADK Service Layer

**Responsibilities:**
- Format requests according to ADK API specification
- Handle HTTP communication with ADK agent
- Parse and transform ADK responses
- Handle errors and retries
- Generate session IDs per message (not persistent)

**Key Methods:**
```typescript
class ADKService {
  async listAgents(): Promise<string[]>  // Fetch from /list-apps
  async sendMessage(request: ADKMessageRequest): Promise<ADKMessageResponse>
  async checkHealth(): Promise<boolean>  // Optional health check
}
```

**Request/Response Types:**
```typescript
interface ADKMessageRequest {
  agentName: string;      // Selected ADK agent name
  message: string;         // User message text
  userId: string;         // Current user ID
  conversationId?: string; // Optional conversation ID for storage
}

interface ADKMessageResponse {
  response: string;        // Agent response text
  agentName: string;       // Agent that responded
  sessionId: string;       // Generated session ID (for this message)
  timestamp: string;        // Response timestamp
}
```

#### 3.2.3 Session Management

**Requirements:**
- Generate unique session ID per message (UUID)
- Session ID is generated fresh for each message (not reused)
- Session ID format: UUID v4
- No session persistence across messages (per user requirement)
- Session storage key pattern: `{agentName}:{userId}:{messageId}` (for logging only)

**Session Generation:**
- Use `uuid` package to generate session IDs
- Each message to ADK agent gets a new session ID
- Session ID is included in ADK request but not stored persistently

#### 3.2.4 Message Storage

**Requirements:**
- Store ADK agent messages in existing `Message` model
- Mark ADK messages with metadata (e.g., `adkAgentName` field)
- Store in same conversation as regular messages
- Maintain message order in conversation

**Message Model Enhancement:**
- Add optional field: `adkAgentName?: string` to Message schema
- If `adkAgentName` is present, message was sent to ADK agent
- If `adkAgentName` is absent, message was sent to regular AI model

#### 3.2.5 Error Handling

**Error Categories:**
1. **ADK Agent Unavailable** (503) - Agent not running on localhost:8000
2. **Invalid Request** (400) - Malformed request (missing agentName, etc.)
3. **Agent Error** (502) - ADK agent returned error
4. **Timeout** (504) - Request timeout (30 seconds)
5. **Network Error** (503) - Connection refused, network issues

**Error Response Format:**
```json
{
  "error": {
    "code": "ADK_AGENT_UNAVAILABLE",
    "message": "Model unavailable, please try again",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

**User-Friendly Messages:**
- ADK unavailable: "Model unavailable, please try again"
- Network error: "Model unavailable, please try again"
- Timeout: "Model unavailable, please try again"
- Invalid request: "Invalid request. Please select an agent and try again."

#### 3.2.6 Configuration Management

**Environment Variables to Add:**
```env
# ADK Agent Configuration
ADK_AGENT_URL=http://localhost:8000
ADK_TIMEOUT=30000  # 30 seconds
ADK_RETRY_ATTEMPTS=3  # Number of retry attempts
ADK_RETRY_DELAY=1000  # Initial retry delay in ms
```

**Update `backend/src/config/env.ts`:**
```typescript
ADK_AGENT_URL: process.env.ADK_AGENT_URL || 'http://localhost:8000',
ADK_TIMEOUT: Number(process.env.ADK_TIMEOUT || 30000),
ADK_RETRY_ATTEMPTS: Number(process.env.ADK_RETRY_ATTEMPTS || 3),
ADK_RETRY_DELAY: Number(process.env.ADK_RETRY_DELAY || 1000),
```

### 3.3 Dependencies to Add

```json
{
  "dependencies": {
    "axios": "^1.6.2",           // HTTP client for ADK communication
    "uuid": "^9.0.1"            // Session ID generation
  },
  "devDependencies": {
    "@types/uuid": "^9.0.6"
  }
}
```

---

## 4. Frontend Implementation Plan

### 4.1 Mention System Enhancement

#### 4.1.1 Current Mention System
- Typing `@` shows list of user-created agents (from DB)
- Mention query is passed to `onMentionQueryChange` callback
- Agents are filtered by name/slug

#### 4.1.2 ADK Agent Detection

**Trigger Detection:**
- When user types `@agents` (exact match, case-insensitive)
- Detect this in `PromptInputTextarea` component
- Show special ADK agent list instead of regular agents

**Implementation Approach:**
1. In `Chat.tsx`, track mention query state
2. When `mentionQuery === 'agents'` (case-insensitive), fetch ADK agents
3. Show ADK agents in mention dropdown
4. When ADK agent selected, store in state for current message

**State Management:**
```typescript
// Add to Chat.tsx state
const [adkAgents, setAdkAgents] = useState<string[]>([]);  // List of ADK agent names
const [adkAgentsLoading, setAdkAgentsLoading] = useState(false);
const [selectedAdkAgent, setSelectedAdkAgent] = useState<string | null>(null);  // Selected for current message
const [adkAgentError, setAdkAgentError] = useState<string | null>(null);
```

#### 4.1.3 Mention Dropdown Enhancement

**UI Flow:**
1. User types `@agents`
2. Frontend detects `mentionQuery === 'agents'`
3. If ADK agents not loaded, fetch from `/api/adk/agents`
4. Show ADK agents in dropdown (separate from regular agents)
5. User selects ADK agent
6. Insert `@agents:<agent_name>` or similar token (or just set state)
7. Show ADK agent pill in UI

**Dropdown Structure:**
```
PromptInputCommand
├── PromptInputCommandGroup (heading: "ADK Agents")
│   ├── PromptInputCommandItem (for each ADK agent)
│   └── ...
└── PromptInputCommandEmpty ("No ADK agents available")
```

### 4.2 API Service Layer Updates

**File**: `frontend/src/api/client.ts`

**Add ADK Methods:**
```typescript
adk: {
  listAgents: () => request<{ agents: string[] }>('/adk/agents'),
  sendMessage: (body: {
    agentName: string;
    message: string;
    conversationId?: string;
  }) => request<{
    response: string;
    agentName: string;
    sessionId: string;
    timestamp: string;
  }>('/adk/message', {
    method: 'POST',
    body: JSON.stringify(body),
  }),
}
```

### 4.3 Message Sending Logic

#### 4.3.1 Current Flow
- `onSend()` function in `Chat.tsx` handles message submission
- Calls `api.ai.stream()` for regular AI messages
- Passes `agentId` if regular agent is selected

#### 4.3.2 ADK Message Flow

**Updated `onSend()` Logic:**
```typescript
async function onSend(userText: string, files?: Attachment[]) {
  // ... existing validation ...
  
  // Check if ADK agent is selected
  if (selectedAdkAgent) {
    // Route to ADK endpoint
    try {
      setStreaming(true);
      const { response, agentName } = await api.adk.sendMessage({
        agentName: selectedAdkAgent,
        message: userText,
        conversationId: activeId || undefined,
      });
      
      // Add user message
      setMessages((m) => [...m, { 
        role: 'user', 
        content: userText,
        attachments: files 
      }]);
      
      // Add ADK agent response
      setMessages((m) => [...m, { 
        role: 'assistant', 
        content: response,
        adkAgentName: agentName  // Mark as ADK message
      }]);
      
      // Clear ADK agent selection for next message
      setSelectedAdkAgent(null);
    } catch (error) {
      // Show error message
      setAdkAgentError('Model unavailable, please try again');
      // Optionally: fall back to regular AI or show error in chat
    } finally {
      setStreaming(false);
    }
    return;
  }
  
  // Otherwise, use regular AI flow
  await api.ai.stream(...);
}
```

**Key Points:**
- ADK agent selection is per-message (cleared after sending)
- If no ADK agent selected in next message, routes to regular AI
- Error handling shows user-friendly message

### 4.4 UI Enhancements

#### 4.4.1 ADK Agent Pill

**Similar to Current Agent Pill:**
- Use `PromptInputActiveModeWebsearch` component (same styling)
- Show when `selectedAdkAgent` is set
- Label: `ADK Agent: {agentName}`
- Click to clear selection

**Implementation:**
```tsx
{selectedAdkAgent && (
  <PromptInputActiveModeWebsearch
    active={true}
    label={`ADK Agent: ${selectedAdkAgent}`}
    onClick={() => setSelectedAdkAgent(null)}
    className="mt-1"
  />
)}
```

#### 4.4.2 Error Display

**Error States:**
- Show error message in chat if ADK agent unavailable
- Display error as assistant message with error styling
- Allow user to retry or switch to regular AI

**Error Message Component:**
```tsx
{adkAgentError && (
  <Message from="assistant">
    <MessageContent variant="error">
      {adkAgentError}
    </MessageContent>
  </Message>
)}
```

### 4.5 State Management Summary

**New State Variables:**
```typescript
const [adkAgents, setAdkAgents] = useState<string[]>([]);
const [adkAgentsLoading, setAdkAgentsLoading] = useState(false);
const [selectedAdkAgent, setSelectedAdkAgent] = useState<string | null>(null);
const [adkAgentError, setAdkAgentError] = useState<string | null>(null);
```

**State Lifecycle:**
1. User types `@agents` → Fetch ADK agents if not loaded
2. User selects ADK agent → Set `selectedAdkAgent`
3. User sends message → Clear `selectedAdkAgent` after sending
4. Next message without ADK agent → Routes to regular AI

---

## 5. Implementation Phases

### Phase 1: Core ADK Integration (MVP)
**Goal**: Basic ADK agent discovery and messaging

**Backend Tasks:**
1. ✅ Install dependencies (`axios`, `uuid`, `@types/uuid`)
2. ✅ Add ADK configuration to `env.ts`
3. ✅ Create `adk.types.ts` with TypeScript interfaces
4. ✅ Create `adk.service.ts` with:
   - `listAgents()` method
   - `sendMessage()` method
   - Error handling and retry logic
5. ✅ Create `adkController.ts` with:
   - `listADKAgents()` controller
   - `sendADKMessage()` controller
6. ✅ Create `adkRoutes.ts` with:
   - `GET /api/adk/agents`
   - `POST /api/adk/message`
7. ✅ Register ADK routes in `routes/index.ts`
8. ✅ Update `Message` model to add optional `adkAgentName` field
9. ✅ Update message controller to handle ADK messages in conversation

**Frontend Tasks:**
1. ✅ Add ADK methods to `api/client.ts`
2. ✅ Add ADK state variables to `Chat.tsx`
3. ✅ Implement `@agents` detection in mention system
4. ✅ Fetch ADK agents when `@agents` is typed
5. ✅ Show ADK agents in mention dropdown
6. ✅ Handle ADK agent selection
7. ✅ Update `onSend()` to route to ADK endpoint when agent selected
8. ✅ Add ADK agent pill UI
9. ✅ Implement error handling and display
10. ✅ Clear ADK agent selection after message sent

**Timeline**: 3-4 days

### Phase 2: Enhanced Features
**Goal**: Production-ready features and polish

**Backend Tasks:**
1. ✅ Add health check endpoint (`GET /api/adk/health`)
2. ✅ Implement connection pooling for ADK requests
3. ✅ Add request logging for ADK calls
4. ✅ Implement caching for agent list (5-minute TTL)
5. ✅ Add rate limiting for ADK endpoints
6. ✅ Enhance error messages with more context
7. ✅ Add timeout handling with proper error messages

**Frontend Tasks:**
1. ✅ Add loading states for ADK agent fetching
2. ✅ Implement retry mechanism for failed ADK requests
3. ✅ Add connection status indicator (optional)
4. ✅ Improve error messages with retry options
5. ✅ Add ADK agent list refresh functionality
6. ✅ Handle ADK agent list caching on frontend
7. ✅ Add visual distinction between ADK and regular agent messages (optional)

**Timeline**: 2-3 days

### Phase 3: Optimization & Testing
**Goal**: Performance, reliability, and testing

**Backend Tasks:**
1. ✅ Add comprehensive error handling tests
2. ✅ Add integration tests for ADK service
3. ✅ Performance testing with multiple concurrent requests
4. ✅ Add monitoring/logging for ADK requests
5. ✅ Optimize session ID generation
6. ✅ Add request/response validation

**Frontend Tasks:**
1. ✅ Add error boundary for ADK-related errors
2. ✅ Test mention system with various inputs
3. ✅ Test message routing (ADK vs regular AI)
4. ✅ Test error scenarios (ADK unavailable, network errors)
5. ✅ Performance testing with large agent lists
6. ✅ Accessibility testing for mention dropdown

**Timeline**: 2-3 days

### Phase 4: Advanced Features (Future)
**Goal**: Enhanced user experience

**Potential Features:**
1. ADK agent descriptions/metadata display
2. ADK agent favorites/recently used
3. Multi-agent conversations (chat with multiple ADK agents)
4. ADK agent search/filter functionality
5. ADK agent response streaming (if supported)
6. ADK agent session persistence (optional, if needed later)
7. ADK agent analytics/metrics

---

## 6. Data Model Changes

### 6.1 Message Model Update

**File**: `backend/src/models/Message.ts`

**Add Field:**
```typescript
adkAgentName?: string;  // Optional: name of ADK agent if message was sent to ADK
```

**Migration:**
- Add field to schema (optional, no migration needed for existing messages)
- Update TypeScript types
- Update message creation logic to include `adkAgentName` when applicable

### 6.2 Conversation Model

**No Changes Required:**
- ADK messages stored in same conversation
- Conversation model remains unchanged
- Messages ordered by timestamp as usual

---

## 7. Error Handling Strategy

### 7.1 Backend Error Handling

**ADK Service Errors:**
```typescript
try {
  // ADK request
} catch (error) {
  if (error.code === 'ECONNREFUSED') {
    throw createError(503, 'Model unavailable, please try again');
  }
  if (error.code === 'ETIMEDOUT') {
    throw createError(504, 'Model unavailable, please try again');
  }
  if (error.response?.status === 404) {
    throw createError(404, 'Agent not found');
  }
  // Generic error
  throw createError(502, 'Model unavailable, please try again');
}
```

**Controller Error Handling:**
- Catch service errors
- Return user-friendly error messages
- Log detailed errors server-side only

### 7.2 Frontend Error Handling

**Error Display:**
- Show error as assistant message in chat
- Use error styling (red text, error icon)
- Allow user to retry or continue with regular AI

**Error Recovery:**
- Clear ADK agent selection on error
- Allow user to send next message to regular AI
- Optionally show "Retry" button

---

## 8. Testing Strategy

### 8.1 Unit Tests

**Backend:**
- ADK service methods
- Error handling scenarios
- Session ID generation
- Request formatting

**Frontend:**
- Mention detection logic
- ADK agent selection
- Message routing logic
- Error handling

### 8.2 Integration Tests

**Backend:**
- End-to-end ADK message flow
- Error scenarios (ADK unavailable, timeout)
- Agent list fetching

**Frontend:**
- Complete user flow: `@agents` → select → send → receive
- Error scenarios
- Switching between ADK and regular AI

### 8.3 Manual Testing Checklist

1. ✅ Type `@agents` and see ADK agent list
2. ✅ Select ADK agent and see pill
3. ✅ Send message to ADK agent
4. ✅ Receive response from ADK agent
5. ✅ Send next message without ADK agent (routes to regular AI)
6. ✅ Test with ADK agent unavailable (shows error)
7. ✅ Test with network error (shows error)
8. ✅ Test with invalid agent name (shows error)
9. ✅ Verify messages stored in same conversation
10. ✅ Verify message order in conversation

---

## 9. Security Considerations

### 9.1 Input Validation

- Validate `agentName` (prevent injection)
- Validate message length (max 10,000 characters)
- Sanitize user input before sending to ADK

### 9.2 CORS Configuration

- ADK agent runs on localhost:8000 (backend-to-backend, no CORS needed)
- Frontend only communicates with backend (existing CORS config sufficient)

### 9.3 Rate Limiting

- Apply existing rate limiting to ADK endpoints
- Prevent abuse of ADK agent discovery
- Limit message sending rate

### 9.4 Error Information

- Don't expose internal ADK errors to frontend
- Sanitize error messages
- Log detailed errors server-side only

---

## 10. Success Criteria

### 10.1 Functional Requirements

- ✅ User can type `@agents` to see ADK agent list
- ✅ User can select ADK agent from list
- ✅ Selected ADK agent shows as pill in UI
- ✅ Messages sent with ADK agent selected go to ADK endpoint
- ✅ ADK agent responses displayed in chat
- ✅ Next message without ADK agent routes to regular AI
- ✅ Messages stored in same conversation
- ✅ Error handling shows "Model unavailable, please try again"
- ✅ User can clear ADK agent selection

### 10.2 Performance Requirements

- ADK agent list fetch: < 1 second
- ADK message response: < 5 seconds (depends on ADK agent)
- Error handling: Immediate feedback

### 10.3 Quality Requirements

- Comprehensive error handling
- Type safety (TypeScript throughout)
- User-friendly error messages
- Consistent UI/UX with existing system

---

## 11. Risk Assessment & Mitigation

### 11.1 Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| ADK agent unavailable | High | Medium | Health checks, graceful error handling |
| ADK API changes | Medium | Low | Abstraction layer, version pinning |
| Performance issues | Medium | Low | Timeout handling, connection pooling |
| Message routing confusion | Medium | Low | Clear state management, testing |
| Session ID conflicts | Low | Low | UUID v4 generation |

### 11.2 Dependencies

- ADK agent must be running on port 8000
- ADK agent must expose `/list-apps` and `/run` endpoints
- Network connectivity between backend and ADK agent
- `axios` and `uuid` packages installed

---

## 12. Next Steps

1. **Review and Approve Plan**
   - Review this plan document
   - Confirm approach and requirements
   - Address any questions or concerns

2. **Set Up Development Environment**
   - Install ADK agent dependencies
   - Configure environment variables
   - Test ADK agent connectivity

3. **Begin Phase 1 Implementation**
   - Start with backend ADK service
   - Implement agent discovery endpoint
   - Implement message endpoint
   - Update frontend mention system
   - Integrate ADK agent selection
   - Test end-to-end flow

4. **Iterate and Test**
   - Test with real ADK agent
   - Refine based on actual API behavior
   - Add features incrementally
   - Gather user feedback

---

## 13. Key Design Decisions

### 13.1 Per-Message Agent Selection
- **Decision**: ADK agent selection is per-message, not persistent
- **Rationale**: User requirement - if next message doesn't select agent, route to regular AI
- **Implementation**: Clear `selectedAdkAgent` after each message

### 13.2 Same Conversation Storage
- **Decision**: Store ADK messages in same conversation as regular messages
- **Rationale**: User requirement - maintain conversation continuity
- **Implementation**: Use same `conversationId`, add `adkAgentName` field to distinguish

### 13.3 New Endpoint for ADK
- **Decision**: Create `/api/adk/message` endpoint separate from `/api/ai/stream`
- **Rationale**: Different communication pattern (request/response vs streaming), cleaner separation
- **Implementation**: New route, controller, and service layer

### 13.4 `@agents` Mention Trigger
- **Decision**: Exact match `@agents` triggers ADK agent list
- **Rationale**: Clear distinction from regular `@` mentions, intuitive for users
- **Implementation**: Case-insensitive matching in mention query handler

### 13.5 Error Message Standardization
- **Decision**: All ADK errors show "Model unavailable, please try again"
- **Rationale**: User-friendly, doesn't expose technical details
- **Implementation**: Catch all ADK errors and return standardized message

---

## 14. Documentation Requirements

- Update `docs/07-Agents-and-Mentions.md` with ADK agent information
- Add ADK agent section to API documentation
- Update README with ADK agent setup instructions
- Add troubleshooting guide for ADK connectivity issues

---

## Conclusion

This plan provides a comprehensive roadmap for integrating Google ADK agents into the 2Knot chat interface. The phased approach allows for incremental development and testing, ensuring a robust and scalable solution. The architecture maintains separation of concerns while integrating seamlessly with the existing system.

**Key Principles:**
- Separation of concerns (service layer, routes, controllers)
- Type safety (TypeScript throughout)
- Error handling at every layer
- User-friendly error messages
- Consistent UI/UX with existing system
- Per-message agent selection (not persistent)
- Same conversation storage for continuity

**Estimated Total Timeline**: 7-10 days for full implementation (all phases)

