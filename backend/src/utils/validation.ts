import createError from 'http-errors';

/**
 * Validation utilities for ADK agent requests
 */

const MAX_MESSAGE_LENGTH = 10000;
const MAX_AGENT_NAME_LENGTH = 200;
const MIN_MESSAGE_LENGTH = 1;

/**
 * Validate and sanitize agent name
 */
export function validateAgentName(agentName: unknown): string {
  if (!agentName || typeof agentName !== 'string') {
    throw createError(400, 'agentName must be a non-empty string');
  }

  const trimmed = agentName.trim();
  
  if (trimmed.length === 0) {
    throw createError(400, 'agentName cannot be empty');
  }

  if (trimmed.length > MAX_AGENT_NAME_LENGTH) {
    throw createError(400, `agentName cannot exceed ${MAX_AGENT_NAME_LENGTH} characters`);
  }

  // Basic sanitization - allow alphanumeric, hyphens, underscores, dots
  // This prevents injection attacks while allowing valid agent names
  if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
    throw createError(400, 'agentName contains invalid characters. Only alphanumeric characters, dots, hyphens, and underscores are allowed.');
  }

  return trimmed;
}

/**
 * Validate and sanitize message content
 */
export function validateMessage(message: unknown): string {
  if (!message || typeof message !== 'string') {
    throw createError(400, 'message must be a non-empty string');
  }

  const trimmed = message.trim();

  if (trimmed.length < MIN_MESSAGE_LENGTH) {
    throw createError(400, 'message cannot be empty');
  }

  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw createError(400, `message cannot exceed ${MAX_MESSAGE_LENGTH} characters`);
  }

  return trimmed;
}

/**
 * Validate conversation ID format (MongoDB ObjectId)
 */
export function validateConversationId(conversationId: unknown): string | undefined {
  if (conversationId === undefined || conversationId === null) {
    return undefined;
  }

  if (typeof conversationId !== 'string') {
    throw createError(400, 'conversationId must be a string');
  }

  const trimmed = conversationId.trim();

  if (trimmed.length === 0) {
    return undefined;
  }

  // MongoDB ObjectId is 24 hex characters
  if (!/^[a-fA-F0-9]{24}$/.test(trimmed)) {
    throw createError(400, 'Invalid conversationId format');
  }

  return trimmed;
}

/**
 * Validate refresh query parameter
 */
export function validateRefreshParam(refresh: unknown): boolean {
  if (refresh === undefined || refresh === null) {
    return false;
  }

  if (typeof refresh === 'boolean') {
    return refresh;
  }

  if (typeof refresh === 'string') {
    return refresh.toLowerCase() === 'true';
  }

  return false;
}

