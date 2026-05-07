import { createOpenAI } from '@ai-sdk/openai';
import { env } from '../config/env';

// Factory to create an OpenAI-compatible client configured for a self-hosted vLLM instance.
// vLLM exposes the standard OpenAI /v1 API surface — no auth required in this setup.
export function createVllmClient() {
  const baseURL = env.VLLM_BASE_URL;
  return createOpenAI({
    // vLLM requires the header to be present but ignores the value when --api-key is not set.
    apiKey: 'vllm',
    baseURL,
  });
}

export function getVllmModelId(): string {
  return env.VLLM_MODEL || 'Qwen/Qwen2.5-Coder-7B-Instruct';
}
