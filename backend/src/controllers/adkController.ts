import { Response, NextFunction } from 'express';
import createError from 'http-errors';
import { AuthenticatedRequest } from '../middleware/auth';
import { adkService } from '../services/adk.service';
import { MessageModel } from '../models/Message';
import { ConversationModel } from '../models/Conversation';
import { validateAgentName, validateMessage, validateConversationId, validateRefreshParam } from '../utils/validation';

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

    // Save assistant message with ADK agent name
    await MessageModel.create({
      conversationId: convId,
      userId,
      role: 'assistant',
      content: sanitizedResponse,
      adkAgentName: validatedAgentName, // Mark as ADK message
    });

    // Return response
    res.json({
      response: adkResponse.response,
      agentName: adkResponse.agentName,
      sessionId: adkResponse.sessionId,
      timestamp: adkResponse.timestamp,
      conversationId: convId,
    });
  } catch (err) {
    next(err);
  }
}

