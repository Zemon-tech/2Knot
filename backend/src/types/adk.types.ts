/**
 * Type definitions for Google ADK Agent integration
 */

export interface ADKMessageRequest {
  agentName: string; // Selected ADK agent name
  message: string; // User message text
  userId: string; // Current user ID
  conversationId?: string; // Optional conversation ID for storage
}

export interface ADKMessageResponse {
  response: string; // Agent response text
  agentName: string; // Agent that responded
  sessionId: string; // Generated session ID (for this message)
  timestamp: string; // Response timestamp
  // Optional: web search sources derived from grounding metadata
  sources?: {
    id: number;
    title: string;
    link: string;
    source?: string;
    favicon?: string;
    date?: string;
    snippet?: string;
  }[];
}

export interface ADKRunRequest {
  app_name: string;
  user_id: string;
  session_id: string;
  new_message: {
    parts: Array<{
      text: string;
    }>;
    role: 'user';
  };
  state_delta: Record<string, unknown>;
}

export interface ADKRunResponse {
  // Response format to be determined during implementation
  // This will be updated based on actual ADK agent response structure
  [key: string]: unknown;
}

