import axios, { AxiosError, AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import { ADKMessageRequest, ADKMessageResponse, ADKRunRequest } from '../types/adk.types';
import createError from 'http-errors';
import http from 'http';
import https from 'https';

/**
 * Service for communicating with Google ADK Agent running on localhost:8000
 */
class ADKService {
  private readonly baseURL: string;
  private readonly timeout: number;
  private readonly retryAttempts: number;
  private readonly retryDelay: number;
  private readonly axiosInstance: AxiosInstance;
  private agentListCache: { agents: string[]; timestamp: number } | null = null;
  private readonly cacheTTL: number = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Normalize localhost to 127.0.0.1 to avoid IPv6 (::1) connection issues
    let normalizedURL = env.ADK_AGENT_URL;
    if (normalizedURL.includes('localhost')) {
      normalizedURL = normalizedURL.replace(/localhost/g, '127.0.0.1');
    }
    this.baseURL = normalizedURL;
    this.timeout = env.ADK_TIMEOUT;
    this.retryAttempts = env.ADK_RETRY_ATTEMPTS;
    this.retryDelay = env.ADK_RETRY_DELAY;

    // Create axios instance with connection pooling
    // Configure agents to prefer IPv4
    const httpAgent = new http.Agent({
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets: 50,
      maxFreeSockets: 10,
      family: 4, // Force IPv4
    });

    const httpsAgent = new https.Agent({
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets: 50,
      maxFreeSockets: 10,
      family: 4, // Force IPv4
    });

    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      httpAgent: httpAgent,
      httpsAgent: httpsAgent,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * List all available ADK agents
   * @param forceRefresh - Force refresh cache
   * @returns Array of agent names
   */
  async listAgents(forceRefresh = false): Promise<string[]> {
    // Check cache first
    if (!forceRefresh && this.agentListCache) {
      const age = Date.now() - this.agentListCache.timestamp;
      if (age < this.cacheTTL) {
        this.log('ADK agent list served from cache');
        return this.agentListCache.agents;
      }
    }

    try {
      this.log('Fetching ADK agent list from ADK service');
      const response = await this.axiosInstance.get<string[]>('/list-apps');
      const agents = Array.isArray(response.data) ? response.data : [];
      
      // Update cache
      this.agentListCache = {
        agents,
        timestamp: Date.now(),
      };
      
      this.log(`Successfully fetched ${agents.length} ADK agents`, { agents });
      return agents;
    } catch (error) {
      this.log('Error fetching ADK agents', error);
      this.handleError(error, 'Failed to fetch ADK agents');
      throw error;
    }
  }

  /**
   * Check ADK agent health
   * @returns true if ADK agent is available
   */
  async checkHealth(): Promise<boolean> {
    try {
      this.log('Checking ADK agent health');
      await this.axiosInstance.get('/list-apps', {
        timeout: 5000, // Shorter timeout for health check
      });
      this.log('ADK agent is healthy');
      return true;
    } catch (error) {
      this.log('ADK agent health check failed', error);
      return false;
    }
  }

  /**
   * Send a message to a selected ADK agent
   * @param request - Message request with agent name, message, and user info
   * @returns Agent response
   */
  async sendMessage(request: ADKMessageRequest): Promise<ADKMessageResponse> {
    const { agentName, message, userId } = request;

    // Generate a new session ID for this message (per-message session)
    const sessionId = uuidv4();

    try {
      // Step 1: Create session first (required before sending messages)
      this.log(`Creating session for ADK agent: ${agentName}`, { userId, sessionId });
      await this.createSession(agentName, userId, sessionId);
      
      // Step 2: Format request according to ADK API specification
      // Note: This ADK agent implementation uses snake_case (FastAPI default)
      const adkRequest: any = {
        app_name: agentName,
        user_id: userId,
        session_id: sessionId,
        new_message: {
          parts: [
            {
              text: message,
            },
          ],
          role: 'user',
        },
        state_delta: {},
      };
      
      // Log the request being sent for debugging
      this.log('ADK request payload', {
        agentName,
        request: JSON.stringify(adkRequest, null, 2),
      });

      // Step 3: Send message to /run endpoint
      this.log(`Sending message to ADK agent: ${agentName}`, { userId, sessionId });
      const response = await this.sendWithRetry(adkRequest);

      // Extract response text from ADK response
      // Note: Response format may need adjustment based on actual ADK agent response
      const responseText = this.extractResponseText(response);

      this.log(`Successfully received response from ADK agent: ${agentName}`);
      return {
        response: responseText,
        agentName: agentName,
        sessionId: sessionId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.log(`Error sending message to ADK agent: ${agentName}`, error);
      this.handleError(error, 'Failed to send message to ADK agent');
      throw error;
    }
  }

  /**
   * Create a new session for the ADK agent
   * Required before sending messages
   */
  private async createSession(appName: string, userId: string, sessionId: string): Promise<void> {
    try {
      const sessionPath = `/apps/${encodeURIComponent(appName)}/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(sessionId)}`;
      // Create session with empty initial state
      await this.axiosInstance.post(sessionPath, {});
      this.log('Session created successfully', { appName, userId, sessionId });
    } catch (error) {
      // If session already exists, that's okay (idempotent)
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        this.log('Session already exists, continuing', { appName, userId, sessionId });
        return;
      }
      // Log other errors but don't fail - the /run endpoint might create the session automatically
      this.log('Session creation failed (may be created automatically by /run)', error);
      // Don't throw - let /run endpoint handle session creation if needed
    }
  }

  /**
   * Send request to ADK agent with retry logic
   */
  private async sendWithRetry(request: ADKRunRequest): Promise<unknown> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        this.log(`ADK request attempt ${attempt}/${this.retryAttempts}`, { app_name: request.app_name });
        // Use /run endpoint as per ADK specification
        // The agent name (app_name) should be in the request body, not the URL
        const response = await this.axiosInstance.post('/run', request);
        
        if (attempt > 1) {
          this.log(`ADK request succeeded on attempt ${attempt}`);
        }
        return response.data;
      } catch (error) {
        lastError = error;
        // Don't retry on client errors (4xx)
        if (axios.isAxiosError(error) && error.response && error.response.status < 500) {
          // Log detailed error response for 422 validation errors
          if (error.response.status === 422) {
            this.log(`ADK request validation error (422)`, {
              requestBody: JSON.stringify(request, null, 2),
              responseData: error.response.data,
              responseStatus: error.response.status,
            });
          } else if (error.response.status === 404) {
            const responseData = error.response.data;
            const errorDetail = responseData?.detail || '';
            
            // Check if it's a "Session not found" error
            if (typeof errorDetail === 'string' && errorDetail.toLowerCase().includes('session')) {
              this.log(`ADK session not found error`, {
                endpoint: '/run',
                app_name: request.app_name,
                session_id: request.session_id,
                responseData: responseData,
              });
              throw createError(404, 'Session not found. Please try again.');
            }
            
            this.log(`ADK request 404 error - /run endpoint not found`, {
              endpoint: '/run',
              app_name: request.app_name,
              responseData: responseData,
              suggestion: 'Check http://127.0.0.1:8000/docs for available endpoints',
            });
            throw createError(404, `ADK agent endpoint /run not found. Please check the ADK agent server configuration. Available endpoints can be viewed at http://127.0.0.1:8000/docs`);
          } else {
            this.log(`ADK request failed with client error (no retry)`, error);
          }
          throw error;
        }
        // Wait before retrying (exponential backoff)
        if (attempt < this.retryAttempts) {
          const delayMs = this.retryDelay * attempt;
          this.log(`ADK request failed, retrying in ${delayMs}ms...`);
          await this.delay(delayMs);
        } else {
          this.log(`ADK request failed after ${this.retryAttempts} attempts`);
        }
      }
    }

    throw lastError;
  }

  /**
   * Extract response text from ADK agent response
   * ADK returns an array of events, we need to extract text from content.parts[0].text
   */
  private extractResponseText(response: unknown): string {
    // If response is already a string, return it
    if (typeof response === 'string') {
      return response;
    }

    // ADK returns an array of events: [{ content: { parts: [{ text: "..." }] } }]
    if (Array.isArray(response) && response.length > 0) {
      // Find the first event with content.parts containing text
      for (const event of response) {
        if (typeof event === 'object' && event !== null) {
          const eventObj = event as Record<string, unknown>;
          
          // Check for ADK event structure: { content: { parts: [{ text: "..." }] } }
          if (eventObj.content && typeof eventObj.content === 'object' && eventObj.content !== null) {
            const content = eventObj.content as Record<string, unknown>;
            if (Array.isArray(content.parts) && content.parts.length > 0) {
              // Extract text from all parts and join them
              const texts: string[] = [];
              for (const part of content.parts) {
                if (typeof part === 'object' && part !== null) {
                  const partObj = part as Record<string, unknown>;
                  if (typeof partObj.text === 'string') {
                    texts.push(partObj.text);
                  }
                }
              }
              if (texts.length > 0) {
                return texts.join('\n');
              }
            }
          }
        }
      }
    }

    // If response is an object (not array), try to extract text
    if (typeof response === 'object' && response !== null && !Array.isArray(response)) {
      const obj = response as Record<string, unknown>;

      // Try common response field names
      if (typeof obj.text === 'string') {
        return obj.text;
      }
      if (typeof obj.response === 'string') {
        return obj.response;
      }
      if (typeof obj.message === 'string') {
        return obj.message;
      }
      
      // Try nested content.parts structure
      if (obj.content && typeof obj.content === 'object' && obj.content !== null) {
        const content = obj.content as Record<string, unknown>;
        if (Array.isArray(content.parts) && content.parts.length > 0) {
          const texts: string[] = [];
          for (const part of content.parts) {
            if (typeof part === 'object' && part !== null) {
              const partObj = part as Record<string, unknown>;
              if (typeof partObj.text === 'string') {
                texts.push(partObj.text);
              }
            }
          }
          if (texts.length > 0) {
            return texts.join('\n');
          }
        }
      }
      
      // Try direct parts array
      if (Array.isArray(obj.parts) && obj.parts.length > 0) {
        const firstPart = obj.parts[0];
        if (typeof firstPart === 'object' && firstPart !== null) {
          const part = firstPart as Record<string, unknown>;
          if (typeof part.text === 'string') {
            return part.text;
          }
        }
      }
    }

    // Fallback: stringify the response
    return JSON.stringify(response);
  }

  /**
   * Handle errors and convert to user-friendly messages
   */
  private handleError(error: unknown, defaultMessage: string): void {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      // Connection refused or network errors
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ECONNRESET') {
        throw createError(503, 'Model unavailable, please try again');
      }

      // Timeout errors
      if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        throw createError(504, 'Model unavailable, please try again');
      }

      // HTTP errors
      if (axiosError.response) {
        const status = axiosError.response.status;
        const responseData = axiosError.response.data;
        
        // Log detailed error for 422 (validation errors)
        if (status === 422) {
          this.log('ADK validation error (422)', {
            status,
            data: responseData,
            request: axiosError.config?.data,
          });
          // Try to extract helpful error message from response
          // FastAPI validation errors are usually in detail array
          let errorMessage = 'Invalid request format. Please check the agent configuration.';
          if (responseData && typeof responseData === 'object') {
            if (responseData.detail) {
              // FastAPI validation errors are usually in detail array
              if (Array.isArray(responseData.detail)) {
                const errors = responseData.detail.map((d: any) => {
                  const field = Array.isArray(d.loc) ? d.loc.slice(1).join('.') : 'unknown';
                  return `${field}: ${d.msg || d.type || 'validation failed'}`;
                }).join('; ');
                errorMessage = `Validation error: ${errors}`;
                this.log('FastAPI validation details', responseData.detail);
              } else {
                errorMessage = `Validation error: ${JSON.stringify(responseData.detail)}`;
              }
            } else if (responseData.message) {
              errorMessage = responseData.message;
            } else if (responseData.error) {
              errorMessage = responseData.error;
            }
          }
          throw createError(422, errorMessage);
        }
        
        if (status === 404) {
          throw createError(404, 'Agent not found');
        }
        if (status >= 500) {
          throw createError(502, 'Model unavailable, please try again');
        }
        if (status >= 400) {
          throw createError(400, 'Invalid request. Please select an agent and try again.');
        }
      }
    }

    // If error is already an http-errors instance, re-throw it
    if (error && typeof error === 'object' && 'status' in error) {
      throw error;
    }

    // Generic error
    throw createError(502, 'Model unavailable, please try again');
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Logging helper
   */
  private log(message: string, data?: unknown): void {
    if (env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log(`[ADK Service] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
  }

  /**
   * Clear agent list cache
   */
  clearAgentListCache(): void {
    this.agentListCache = null;
    this.log('ADK agent list cache cleared');
  }
}

export const adkService = new ADKService();

