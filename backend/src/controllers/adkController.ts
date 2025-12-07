import { Response, NextFunction } from 'express';
import createError from 'http-errors';
import { AuthenticatedRequest } from '../middleware/auth';
import { adkService } from '../services/adk.service';
import { MessageModel } from '../models/Message';
import { ConversationModel } from '../models/Conversation';
import { validateAgentName, validateMessage, validateConversationId, validateRefreshParam } from '../utils/validation';
import { randomUUID } from 'crypto';

const MAX_MESSAGE_LENGTH = 10000;

/**
 * List all available ADK agents
 * GET /api/adk/agents
 * Query: ?refresh=true to force refresh cache
 */
export async function listADKAgents(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { refresh } = req.query;
    const forceRefresh = validateRefreshParam(refresh);
    
    const agents = await adkService.listAgents(forceRefresh);
    
    // Check if cache exists (using a getter method would be better, but this works for now)
    const cacheInfo = (adkService as any).agentListCache;
    
    // Validate agent names in response
    const validAgents = agents.filter((agent): agent is string => {
      try {
        validateAgentName(agent);
        return true;
      } catch {
        return false;
      }
    });

    res.json({ 
      agents: validAgents, 
      cached: !forceRefresh && cacheInfo !== null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Stream a message to a selected ADK agent using SSE
 * POST /api/adk/stream
 * Body: { agentName: string, message: string, conversationId?: string }
 */
export async function streamADKMessage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { agentName, message, conversationId } = req.body as {
      agentName: string;
      message: string;
      conversationId?: string;
    };

    const validatedAgentName = validateAgentName(agentName);
    const validatedMessage = validateMessage(message);
    const validatedConversationId = validateConversationId(conversationId);

    // Get or create conversation
    let convId = validatedConversationId;
    if (convId) {
      const conv = await ConversationModel.findOne({ _id: convId, userId }).lean();
      if (!conv) throw createError(404, 'Conversation not found');
    } else {
      const title = validatedMessage.length > 60 ? validatedMessage.slice(0, 60) + '…' : validatedMessage;
      const conv = await ConversationModel.create({
        userId,
        title: title || 'New Chat',
      });
      convId = conv._id.toString();
    }

    // Save user message
    await MessageModel.create({
      conversationId: convId,
      userId,
      role: 'user',
      content: validatedMessage,
      adkAgentName: undefined,
    });

    // Configure SSE headers
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      (res as any).flushHeaders?.();
    }

    // Use the underlying axios instance from adkService to call /run_sse for true streaming
    const adkAxios = (adkService as any).axiosInstance as import('axios').AxiosInstance | undefined;
    if (!adkAxios) {
      throw createError(500, 'ADK client not initialized');
    }

    // Create a dedicated ADK session for this streaming run (required before /run_sse)
    const sessionId = randomUUID();
    const sessionPath = `/apps/${encodeURIComponent(validatedAgentName)}/users/${encodeURIComponent(
      userId.toString(),
    )}/sessions/${encodeURIComponent(sessionId)}`;
    try {
      await adkAxios.post(sessionPath, {});
    } catch (sessionErr: any) {
      const status = sessionErr?.response?.status;
      // 409 = session already exists, safe to ignore; otherwise surface the error
      if (status !== 409) {
        throw sessionErr;
      }
    }

    const adkRequest: any = {
      app_name: validatedAgentName,
      user_id: userId.toString(),
      session_id: sessionId,
      new_message: {
        parts: [
          {
            text: validatedMessage,
          },
        ],
        role: 'user',
      },
      state_delta: {},
      streaming: true,
    };

    const adkRes = await adkAxios.post('/run_sse', adkRequest, {
      responseType: 'stream',
      headers: { Accept: 'text/event-stream' },
    });

    const events: any[] = [];
    let assistantText = '';

    adkRes.data.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      const parts = text.split('\n\n');
      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        let evt: any;
        try {
          evt = JSON.parse(payload);
        } catch {
          continue;
        }
        events.push(evt);

        // Derive cumulative text from all events so far and emit delta
        const current = adkService.extractResponseText(events);
        if (typeof current === 'string' && current.length >= assistantText.length) {
          const delta = current.slice(assistantText.length);
          if (delta) {
            assistantText = current;
            try {
              res.write(`data: ${JSON.stringify({ type: 'delta', delta })}\n\n`);
            } catch {}
          }
        }
      }
    });

    adkRes.data.on('end', async () => {
      try {
        const fullText = (assistantText || '').trim().slice(0, MAX_MESSAGE_LENGTH * 2);
        const sources = adkService.extractSources(events);

        if (fullText) {
          await MessageModel.create({
            conversationId: convId,
            userId,
            role: 'assistant',
            content: fullText,
            adkAgentName: validatedAgentName,
            sources: Array.isArray(sources) && sources.length ? sources : undefined,
          });
        }

        if (sources && sources.length) {
          try {
            res.write(`data: ${JSON.stringify({ type: 'sources', sources })}\n\n`);
          } catch {}
        }

        try {
          res.write(`data: ${JSON.stringify({ type: 'done', conversationId: convId })}\n\n`);
        } catch {}
        res.end();
      } catch (err) {
        if (res.headersSent) {
          try {
            res.write(`data: ${JSON.stringify({ type: 'error', message: (err as Error).message || 'ADK stream error' })}\n\n`);
          } catch {}
          res.end();
          return;
        }
        next(err);
      }
    });

    adkRes.data.on('error', (err: any) => {
      try {
        res.write(`data: ${JSON.stringify({ type: 'error', message: String(err?.message || 'ADK stream error') })}\n\n`);
      } catch {}
      res.end();
    });
  } catch (err) {
    // If we've already started SSE, send an error event instead of delegating to JSON error handler
    if (res.headersSent) {
      try {
        res.write(`data: ${JSON.stringify({ type: 'error', message: (err as Error).message || 'ADK stream error' })}\n\n`);
      } catch {}
      res.end();
      return;
    }
    next(err);
  }
}

/**
 * Check ADK agent health
 * GET /api/adk/health
 */
export async function checkADKHealth(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const isHealthy = await adkService.checkHealth();
    res.json({ healthy: isHealthy, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

/**
 * Send a message to a selected ADK agent
 * POST /api/adk/message
 * Body: { agentName: string, message: string, conversationId?: string }
 */
export async function sendADKMessage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { agentName, message, conversationId } = req.body;

    // Validate and sanitize inputs
    const validatedAgentName = validateAgentName(agentName);
    const validatedMessage = validateMessage(message);
    const validatedConversationId = validateConversationId(conversationId);

    // Get or create conversation
    let convId = validatedConversationId;
    if (convId) {
      const conv = await ConversationModel.findOne({ _id: convId, userId }).lean();
      if (!conv) {
        throw createError(404, 'Conversation not found');
      }
    } else {
      // Create new conversation with title from first message
      const title = validatedMessage.length > 60 ? validatedMessage.slice(0, 60) + '…' : validatedMessage;
      const conv = await ConversationModel.create({
        userId,
        title: title || 'New Chat',
      });
      convId = conv._id.toString();
    }

    // Save user message
    await MessageModel.create({
      conversationId: convId,
      userId,
      role: 'user',
      content: validatedMessage,
      adkAgentName: undefined, // User messages don't have adkAgentName
    });

    // Send message to ADK agent
    const adkResponse = await adkService.sendMessage({
      agentName: validatedAgentName,
      message: validatedMessage,
      userId: userId.toString(),
      conversationId: convId,
    });

    // Validate and sanitize response before saving
    const sanitizedResponse = typeof adkResponse.response === 'string' 
      ? adkResponse.response.trim().slice(0, MAX_MESSAGE_LENGTH * 2) // Allow longer responses from agent
      : String(adkResponse.response || '').slice(0, MAX_MESSAGE_LENGTH * 2);

    // Save assistant message with ADK agent name and any web sources (if provided)
    await MessageModel.create({
      conversationId: convId,
      userId,
      role: 'assistant',
      content: sanitizedResponse,
      adkAgentName: validatedAgentName, // Mark as ADK message
      sources: Array.isArray(adkResponse.sources) ? adkResponse.sources : undefined,
    });

    // Return response (including sources, if available)
    res.json({
      response: adkResponse.response,
      agentName: adkResponse.agentName,
      sessionId: adkResponse.sessionId,
      timestamp: adkResponse.timestamp,
      conversationId: convId,
      sources: adkResponse.sources,
    });
  } catch (err) {
    next(err);
  }
}

