# Google ADK Agent Integration Plan

## Executive Summary

This guide explains how Quild AI connects to a Google ADK (Agent Development Kit) agent running on `localhost:8000`. The Express/TypeScript backend proxies requests via `/api/adk/*`, and the frontend mention menu shows ADK agents together with your custom (DB) agents.

### Quick Start (Local)
1) Run ADK agent (Python venv):
```bash
adk web
```
Verify: `curl http://127.0.0.1:8000/list-apps` → returns `["agent_name", ...]`.

2) Backend (`backend/.env` important vars):
```env
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
ADK_AGENT_URL=http://localhost:8000
```
Start: `npm run dev --prefix backend`

3) Frontend (`frontend/.env`):
```env
VITE_API_BASE=http://localhost:4000/api
```
Start: `npm run dev --prefix frontend`

### Implemented Backend Endpoints
- GET `/api/adk/health` → `{ healthy, timestamp }`
- GET `/api/adk/agents?refresh=true` → `{ agents: string[], cached, timestamp }`
- POST `/api/adk/message` body `{ agentName, message, conversationId? }` → `{ response, agentName, sessionId, conversationId, timestamp }`

### Frontend UX
- Typing `@` opens the mention menu.
- ADK agents are fetched automatically on first open and shown above custom agents.
- Selecting an ADK agent applies to the current message only; the next message reverts to normal unless you select again.

### Troubleshooting
- ADK agents not visible:
  - Ensure ADK is running: `curl http://127.0.0.1:8000/list-apps`.
  - Check backend health: `curl http://localhost:4000/api/adk/health`.
  - Use the refresh icon in the menu (next to “Create new agent…”) to reload ADK and custom agents.
- Message error “Model unavailable…”: confirm `ADK_AGENT_URL` matches your ADK server and it’s reachable from the backend host.

---

## 1. Architecture Overview

### 1.1 System Components

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Frontend      │────────▶│  Express Backend │────────▶│  Google ADK     │
│  (React/TS)     │  HTTP   │   (Node.js/TS)   │  HTTP   │  Agent (8000)   │
│  Port: 5173     │◀────────│   Port: 3000     │◀────────│  localhost:8000 │
└─────────────────┘         └──────────────────┘         └─────────────────┘
```

### 1.2 Communication Flow

1. **User clicks "List Agents" button** → Frontend requests available agents
2. **Frontend → Backend** → GET `/api/agent/list`
3. **Backend → ADK Agent** → GET `http://localhost:8000/list-apps`
4. **ADK Agent → Backend** → Returns list of available agents
5. **Backend → Frontend** → Returns agent list
6. **Frontend** → Displays agents in selection UI
7. **User selects an agent** → Frontend stores selected agent
8. **User sends message** → Frontend captures input with selected agent
9. **Frontend → Backend** → POST `/api/chat/message` with user message and selected agent
10. **Backend → ADK Agent** → POST `http://localhost:8000/run` with formatted request (including selected agent name)
11. **ADK Agent → Backend** → Returns agent response
12. **Backend → Frontend** → Returns formatted response to frontend
13. **Frontend** → Displays response in chat interface

---

## 2. Google ADK Agent API Specifications

### 2.1 Key Endpoints

Based on research, the ADK agent exposes the following endpoints:

#### 2.1.1 List Available Agents
- **Endpoint**: `GET http://localhost:8000/list-apps`
- **Purpose**: Discover available agent applications
- **Response**: `["agent_name_1", "agent_name_2", ...]`

#### 2.1.2 Send Chat Message (Primary Endpoint)
- **Endpoint**: `POST http://localhost:8000/run`
- **Purpose**: Send messages to the agent and receive responses
- **Request Body Format**:
```json
{
  "appName": "your_agent_name",  // This comes from user's agent selection
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
  "stateDelta": {
    // Optional: any state updates
  }
}
```

**Note**: The `appName` field must be populated with the agent name selected by the user in the frontend. The backend will receive the selected agent name and include it in the request to ADK.

- **Response Format**: (To be determined during implementation)
  - Contains agent response text
  - May include events, state updates, metadata

#### 2.1.3 Session Management
- **Endpoint**: `PATCH http://localhost:8000/apps/{agent_name}/users/{user_id}/sessions/{session_id}`
- **Purpose**: Update session state
- **Request Body**: `{"stateDelta": {...}}`

### 2.2 Important Notes
- ADK uses FastAPI internally
- Interactive API docs available at `http://localhost:8000/docs` when agent is running
- Session management is important for maintaining conversation context
- The exact response format needs to be verified during implementation

---

## 3. Backend Implementation Plan

### 3.1 Project Structure

```
backend/
├── src/
│   ├── server.ts              # Main server entry point
│   ├── routes/
│   │   ├── chat.routes.ts     # Chat-related routes
│   │   └── agent.routes.ts    # Agent discovery routes
│   ├── services/
│   │   ├── adk.service.ts     # ADK agent communication service
│   │   └── session.service.ts # Session management service
│   ├── middleware/
│   │   ├── errorHandler.ts    # Global error handling
│   │   ├── rateLimiter.ts     # Rate limiting
│   │   └── validator.ts       # Request validation
│   ├── types/
│   │   ├── adk.types.ts       # ADK API type definitions
│   │   └── chat.types.ts      # Chat interface types
│   ├── utils/
│   │   ├── logger.ts          # Logging utility
│   │   └── config.ts          # Configuration management
│   └── __tests__/             # Test files
├── .env                       # Environment variables
├── tsconfig.json
└── package.json
```

### 3.2 Core Features to Implement

#### 3.2.1 API Routes

**Chat Routes** (`/api/chat/*`)
- `POST /api/chat/message` - Send message to selected agent (requires agentName in request body)
- `GET /api/chat/sessions/:sessionId` - Get session info
- `DELETE /api/chat/sessions/:sessionId` - Clear session
- `POST /api/chat/sessions` - Create new session for selected agent

**Agent Routes** (`/api/agent/*`)
- `GET /api/agent/list` - List all available agents (HIGH PRIORITY - needed for agent selection)
- `GET /api/agent/health` - Check agent connectivity

#### 3.2.2 ADK Service Layer

**Responsibilities:**
- Format requests according to ADK API specification
- Handle HTTP communication with ADK agent
- Parse and transform ADK responses
- Handle errors and retries
- Support for streaming (if ADK supports it)

**Key Methods:**
```typescript
class ADKService {
  async listAgents(): Promise<string[]>  // Must be implemented first for agent selection
  async sendMessage(request: ChatRequest): Promise<ChatResponse>  // Requires agentName in request
  async updateSession(agentName: string, sessionId: string, stateDelta: object): Promise<Session>
  async createSession(agentName: string, userId: string): Promise<Session>
}
```

**Note**: All methods that interact with ADK agent must include `agentName` parameter to route requests to the correct agent.

#### 3.2.3 Session Management

**Requirements:**
- Generate unique session IDs
- Store session state (in-memory for MVP, database for production)
- Map frontend sessions to ADK sessions **per agent** (each agent has its own session)
- Handle session expiration
- Support multiple concurrent sessions **across different agents**
- Session storage key: `{agentName}:{userId}:{sessionId}`

**Session Storage Options:**
- **MVP**: In-memory Map/object
- **Production**: Redis or PostgreSQL

#### 3.2.4 Error Handling

**Error Categories:**
1. **ADK Agent Unavailable** (503) - Agent not running
2. **Invalid Request** (400) - Malformed request
3. **Agent Error** (502) - Agent returned error
4. **Timeout** (504) - Request timeout
5. **Rate Limit** (429) - Too many requests

**Error Response Format:**
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "timestamp": "2024-01-01T00:00:00Z",
    "requestId": "unique-request-id"
  }
}
```

#### 3.2.5 Middleware Stack

1. **CORS** - Allow frontend origin
2. **Body Parser** - JSON parsing
3. **Request Logging** - Log all requests
4. **Rate Limiting** - Prevent abuse
5. **Error Handler** - Global error handling
6. **Request ID** - Add unique ID to each request

### 3.3 Configuration Management

**Environment Variables:**
```env
# Server
PORT=3000
NODE_ENV=development

# ADK Agent
ADK_AGENT_URL=http://localhost:8000
ADK_AGENT_NAME=default_agent  # Default agent name (fallback, but user should select)
ADK_TIMEOUT=30000  # 30 seconds
AGENT_LIST_CACHE_TTL=300000  # 5 minutes cache for agent list

# CORS
FRONTEND_URL=http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
```

### 3.4 Dependencies to Add

```json
{
  "dependencies": {
    "axios": "^1.6.2",           // HTTP client for ADK communication
    "uuid": "^9.0.1",            // Session ID generation
    "express-rate-limit": "^7.1.5"  // Rate limiting
  },
  "devDependencies": {
    "@types/uuid": "^9.0.6"
  }
}
```

---

## 3.5 Agent Selection Workflow

### 3.5.1 User Flow

1. **Initial State**: User opens chat interface
   - No agent selected
   - Chat input disabled or shows "Select an agent first"
   - "List Agents" button visible

2. **Fetching Agents**: User clicks "List Agents" button
   - Button shows loading state
   - Frontend calls `GET /api/agent/list`
   - Backend calls `GET http://localhost:8000/list-apps`
   - Agents list returned to frontend

3. **Displaying Agents**: Agent list is displayed
   - Dropdown populated with agent names
   - Or agent cards displayed
   - User can see all available agents

4. **Selecting Agent**: User selects an agent
   - Selected agent stored in state
   - UI updates to show selected agent
   - Chat input becomes enabled
   - Session created/retrieved for selected agent

5. **Sending Messages**: User sends message
   - Message includes `agentName` in request
   - Backend routes to correct ADK agent
   - Response displayed in chat

6. **Switching Agents**: User can select different agent
   - Previous agent's session preserved
   - New session created for new agent
   - Messages context switches to new agent

### 3.5.2 Request/Response Formats

**List Agents Request:**
```http
GET /api/agent/list
```

**List Agents Response:**
```json
{
  "agents": ["agent_1", "agent_2", "agent_3"],
  "timestamp": "2024-01-01T00:00:00Z"
}
```

**Send Message Request (Updated):**
```json
{
  "message": "Hello, how are you?",
  "agentName": "selected_agent_name",  // REQUIRED - from user selection
  "sessionId": "optional_session_id"   // Optional - for conversation continuity
}
```

**Send Message Response:**
```json
{
  "response": "Agent's response text",
  "sessionId": "session_id",
  "agentName": "selected_agent_name",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

---

## 4. Frontend Integration Plan

### 4.1 API Service Layer

Create a service to handle backend communication:

**File**: `frontend/src/services/api.ts`

**Key Methods:**
```typescript
class ChatAPI {
  async getAgents(): Promise<string[]>  // List all available agents
  async sendMessage(message: string, agentName: string, sessionId?: string): Promise<ChatResponse>
  async createSession(agentName: string): Promise<Session>
}
```

**Request Format for sendMessage:**
```typescript
{
  message: string;
  agentName: string;  // Required - selected agent name
  sessionId?: string; // Optional - for conversation continuity
}
```

### 4.2 State Management Updates

**Current State:**
- Messages array
- Input value
- Loading state

**Additional State Needed:**
- **Selected Agent** (`selectedAgent: string | null`) - Currently selected agent name
- **Available Agents** (`agents: string[]`) - List of all available agents
- **Agents Loading** (`agentsLoading: boolean`) - Loading state for agent list
- Session ID (per agent: `sessions: Map<agentName, sessionId>`)
- Connection status
- Error state

### 4.3 UI Enhancements

1. **Agent List Button** - Prominent button in header/sidebar to fetch and display available agents
   - Button label: "List Agents" or "Refresh Agents"
   - Loading state while fetching
   - Error handling if agent list fails to load
   - Auto-refresh option (optional)

2. **Agent Selection UI** - User interface for selecting an agent
   - **Dropdown/Select Component** - Display list of available agents
   - **Agent Cards** - Visual cards showing each agent (alternative to dropdown)
   - **Selected Agent Indicator** - Clear visual indication of currently selected agent
   - **Validation** - Prevent sending messages without selecting an agent
   - **Placeholder** - "Select an agent to start chatting" when no agent selected

3. **Agent Selection Flow**:
   - User clicks "List Agents" button
   - Frontend fetches agents from backend
   - Agents are displayed in selection UI
   - User selects an agent from the list
   - Selected agent is stored in state
   - Chat interface becomes active for selected agent
   - Messages sent will be routed to selected agent

4. **Error Display** - Show error messages to user
   - Agent list fetch errors
   - Agent selection errors
   - Message sending errors

5. **Connection Status** - Indicate if backend/agent is connected
   - Show status for selected agent specifically

6. **Session Management** - Clear conversation button
   - Clear session for currently selected agent
   - Option to switch agents (creates new session)

7. **Streaming Support** - Real-time message updates (if ADK supports)

**UI Layout Suggestions:**
- Header: Agent selection dropdown + "List Agents" button
- Or Sidebar: Agent list with selection + "Refresh" button
- Chat area: Disabled until agent is selected, shows "Please select an agent" message

### 4.4 Environment Configuration

**File**: `frontend/.env`
```env
VITE_API_URL=http://localhost:3000
```

---

## 5. Scalability & Performance Considerations

### 5.1 Connection Pooling

- Use HTTP keep-alive for ADK connections
- Implement connection pooling with axios
- Reuse connections to reduce overhead

### 5.2 Caching Strategy

- Cache agent list (TTL: 5 minutes)
- Cache session metadata
- Avoid redundant requests

### 5.3 Rate Limiting

**Per User:**
- 100 requests per 15 minutes
- Burst: 10 requests per minute

**Per IP:**
- 200 requests per 15 minutes

### 5.4 Timeout Management

- Request timeout: 30 seconds
- Connection timeout: 10 seconds
- Retry logic: 3 attempts with exponential backoff

### 5.5 Load Balancing (Future)

- Multiple backend instances
- Session affinity (sticky sessions)
- Health checks for ADK agent

### 5.6 Monitoring & Observability

**Metrics to Track:**
- Request latency (p50, p95, p99)
- Error rates
- Active sessions
- ADK agent response times
- Request throughput

**Logging:**
- Structured logging (JSON format)
- Request/response logging
- Error stack traces
- Performance metrics

---

## 6. Security Considerations

### 6.1 Input Validation

- Sanitize user input
- Validate message length (max 10,000 characters)
- Validate session IDs format
- Prevent injection attacks

### 6.2 CORS Configuration

- Restrict to frontend origin only
- No wildcard origins
- Credentials handling if needed

### 6.3 Rate Limiting

- Prevent DDoS attacks
- Per-user and per-IP limits
- Graceful degradation

### 6.4 Error Information

- Don't expose internal ADK errors to frontend
- Sanitize error messages
- Log detailed errors server-side only

---

## 7. Testing Strategy

### 7.1 Unit Tests

- ADK service methods
- Session management
- Request/response transformation
- Error handling

### 7.2 Integration Tests

- End-to-end message flow
- Session lifecycle
- Error scenarios
- ADK agent connectivity

### 7.3 Mock ADK Agent

- Create mock server for testing
- Simulate various response scenarios
- Test error conditions

### 7.4 Load Testing

- Concurrent user simulation
- Stress testing
- Performance benchmarking

---

## 8. Implementation Phases

### Phase 1: MVP (Minimum Viable Product)
**Goal**: Basic chat functionality with agent selection

1. ✅ Backend TypeScript setup (already done)
2. **Implement `/api/agent/list` endpoint** - Fetch available agents from ADK
3. Create ADK service with `listAgents()` method
4. **Frontend: Add "List Agents" button** - UI to trigger agent list fetch
5. **Frontend: Agent selection UI** - Dropdown/select component to choose agent
6. **Frontend: Store selected agent in state** - Track which agent user selected
7. Create ADK service with `sendMessage()` method (requires agentName)
8. Implement `/api/chat/message` endpoint (requires agentName in request)
9. Simple session management (in-memory, per agent)
10. Update frontend to call backend API with selected agent
11. **Frontend: Validate agent selection** - Prevent sending without agent selected
12. Basic error handling

**Timeline**: 2-3 days

### Phase 2: Enhanced Features
**Goal**: Production-ready features

1. Session persistence (per agent)
2. **Agent list caching** - Cache agent list with TTL to reduce API calls
3. **Auto-refresh agent list** - Periodic refresh of available agents
4. Comprehensive error handling
5. Rate limiting
6. Request logging
7. Frontend error handling (agent list errors, selection errors)
8. Connection status indicators (per agent)
9. **Agent switching** - Allow users to switch agents mid-conversation
10. **Agent info display** - Show agent details/metadata if available

**Timeline**: 2-3 days

### Phase 3: Optimization & Scaling
**Goal**: Performance and reliability

1. Connection pooling
2. Caching strategy
3. Retry logic with backoff
4. Monitoring and metrics
5. Load testing
6. Documentation

**Timeline**: 2-3 days

### Phase 4: Advanced Features (Future)
**Goal**: Enhanced user experience

1. Streaming support (if ADK supports it)
2. **Multi-agent conversations** - Chat with multiple agents simultaneously in separate tabs/panels
3. **Agent comparison** - Compare responses from different agents
4. Session history (per agent)
5. Message persistence (per agent)
6. Analytics dashboard (per agent metrics)
7. **Agent favorites** - Save frequently used agents
8. **Agent search/filter** - Search through available agents if list is large

---

## 9. Risk Assessment & Mitigation

### 9.1 Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| ADK agent unavailable | High | Medium | Health checks, graceful degradation |
| ADK API changes | Medium | Low | Version pinning, abstraction layer |
| Performance issues | Medium | Medium | Load testing, optimization |
| Session data loss | Low | Low | Persistent storage in Phase 2 |
| CORS issues | Low | Low | Proper CORS configuration |

### 9.2 Dependencies

- ADK agent must be running on port 8000
- ADK agent must expose `/run` endpoint
- Network connectivity between backend and ADK agent

---

## 10. Success Criteria

### 10.1 Functional Requirements

- ✅ User can list all available agents via "List Agents" button
- ✅ User can select an agent from the available list
- ✅ Selected agent is clearly indicated in the UI
- ✅ User cannot send messages without selecting an agent
- ✅ User can send messages through frontend to selected agent
- ✅ Messages are delivered to the correct ADK agent (based on selection)
- ✅ Agent responses are displayed in frontend
- ✅ Sessions are maintained per agent across messages
- ✅ User can switch between agents (creates separate sessions)
- ✅ Errors are handled gracefully (agent list errors, selection errors, message errors)
- ✅ Multiple users can use the system concurrently with different agent selections

### 10.2 Performance Requirements

- Response time < 2 seconds (p95)
- Support 50+ concurrent users
- 99.9% uptime
- Error rate < 1%

### 10.3 Quality Requirements

- Comprehensive error handling
- Structured logging
- Type safety (TypeScript)
- Code coverage > 80%

---

## 11. Next Steps

1. **Verify ADK Agent Endpoints**
   - Start ADK agent: `adk web`
   - Access `http://localhost:8000/docs` for API documentation
   - Test `/run` endpoint manually with curl/Postman
   - Document exact request/response formats

2. **Set Up Development Environment**
   - Configure environment variables
   - Install additional dependencies
   - Set up testing framework

3. **Begin Phase 1 Implementation**
   - Start with ADK service `listAgents()` method
   - Implement `/api/agent/list` endpoint
   - Add "List Agents" button in frontend
   - Implement agent selection UI in frontend
   - Update ADK service `sendMessage()` to require agentName
   - Implement `/api/chat/message` endpoint with agentName
   - Connect frontend to backend with agent selection flow

4. **Iterate and Test**
   - Test with real ADK agent
   - Refine based on actual API behavior
   - Add features incrementally

---

## 12. Documentation Requirements

- API documentation (OpenAPI/Swagger)
- Environment variable reference
- Deployment guide
- Troubleshooting guide
- Architecture diagrams

---

## Conclusion

This plan provides a comprehensive roadmap for integrating the chat interface with the Google ADK agent. The phased approach allows for incremental development and testing, ensuring a robust and scalable solution. The architecture is designed to be flexible and adaptable to changes in the ADK API or requirements.

**Key Principles:**
- Separation of concerns (service layer, routes, middleware)
- Type safety (TypeScript throughout)
- Error handling at every layer
- Scalability from the start
- Maintainability through clear structure

**Estimated Total Timeline**: 6-9 days for full implementation

