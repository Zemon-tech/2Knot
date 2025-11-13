import { createOpenAI } from '@ai-sdk/openai';
import { env } from '../config/env';

// Factory to create an OpenAI-compatible client configured for Groq
export function createGroqClient() {
  const baseURL = 'https://api.groq.com/openai/v1';
  if (!env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is required when using Groq provider');
  }
  return createOpenAI({
    apiKey: env.GROQ_API_KEY,
    baseURL,
  });
}

export function getGroqModelId(): string {
  return env.GROQ_MODEL || 'llama-3.3-70b-versatile';
}
