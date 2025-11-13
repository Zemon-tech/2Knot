import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { streamAIResponse, generateConversationTitle, listOpenRouterModels, listGroqModels } from '../controllers/aiController';

export const aiRouter = Router();

aiRouter.use(requireAuth);
aiRouter.post('/stream', streamAIResponse);
aiRouter.post('/title', generateConversationTitle);
aiRouter.get('/models/openrouter', listOpenRouterModels);
aiRouter.get('/models/groq', listGroqModels);


