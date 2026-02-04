import dotenv from 'dotenv';

dotenv.config();

function required(name: string, defaultValue?: string): string {
  const value = process.env[name] ?? defaultValue;
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  NODE_ENV: (process.env.NODE_ENV || 'development') as 'development' | 'test' | 'production',
  PORT: Number(process.env.PORT || 4000),
  MONGODB_URI: required('MONGODB_URI'),
  JWT_ACCESS_SECRET: required('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET'),
  CLIENT_ORIGIN: required('CLIENT_ORIGIN', 'http://localhost:5173'),
  GEMINI_API_KEY: required('GEMINI_API_KEY'),
  GEMINI_BASE_URL: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-3-flash-preview',
  // Optional provider selection (defaults to gemini to preserve current behavior)
  AI_PROVIDER: (process.env.AI_PROVIDER || 'gemini') as 'gemini' | 'openrouter' | 'groq',
  // OpenRouter configuration (optional; only required if using OpenRouter)
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || 'openrouter/auto',
  OPENROUTER_REFERER: process.env.OPENROUTER_REFERER || '',
  OPENROUTER_TITLE: process.env.OPENROUTER_TITLE || 'Quild AI',
  // Groq configuration (optional; only required if using Groq)
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  GROQ_MODEL: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  // SerpAPI configuration (optional; only required if web search is enabled)
  SERPAPI_KEY: process.env.SERPAPI_KEY || '',
  // Supabase storage configuration
  SUPABASE_URL: required('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: required('SUPABASE_SERVICE_ROLE_KEY'),
  SUPABASE_BUCKET: required('SUPABASE_BUCKET'),
  // ElevenLabs configuration (optional; required only for voice features)
  ELEVEN_API_KEY: process.env.ELEVEN_API_KEY || '',
  ELEVEN_TTS_MODEL: process.env.ELEVEN_TTS_MODEL || 'eleven_turbo_v2_5',
  ELEVEN_STT_MODEL: process.env.ELEVEN_STT_MODEL || 'scribe_v1',
  ELEVEN_VOICE_ID: process.env.ELEVEN_VOICE_ID || '21m00Tcm4TlvDq8ikWAM',
  ELEVEN_AGENT_ID: process.env.ELEVEN_AGENT_ID || '',
  // ADK Agent configuration
  ADK_AGENT_URL: process.env.ADK_AGENT_URL || 'http://localhost:8000',
  ADK_TIMEOUT: Number(process.env.ADK_TIMEOUT || 30000),
  ADK_RETRY_ATTEMPTS: Number(process.env.ADK_RETRY_ATTEMPTS || 3),
  ADK_RETRY_DELAY: Number(process.env.ADK_RETRY_DELAY || 1000),
};
