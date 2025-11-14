import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { streamAIResponse, generateConversationTitle, listOpenRouterModels, listGroqModels } from '../controllers/aiController';
import { analyzeImage, listUserImages, deleteUserImage } from '../controllers/imageController';

export const aiRouter = Router();

aiRouter.use(requireAuth);
aiRouter.post('/stream', streamAIResponse);
aiRouter.post('/title', generateConversationTitle);
aiRouter.get('/models/openrouter', listOpenRouterModels);
aiRouter.get('/models/groq', listGroqModels);
aiRouter.post('/image/analyze', analyzeImage);
aiRouter.get('/image/list', listUserImages);
aiRouter.delete('/image', deleteUserImage);
