import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { streamAIResponse, generateConversationTitle, listOpenRouterModels, listGroqModels } from '../controllers/aiController';
import { analyzeImage, listUserImages, deleteUserImage } from '../controllers/imageController';
import { tts, stt, elevenlabsWebRTCToken } from '../controllers/voiceController';

export const aiRouter = Router();

aiRouter.use(requireAuth);
aiRouter.post('/stream', streamAIResponse);
aiRouter.post('/title', generateConversationTitle);
aiRouter.get('/models/openrouter', listOpenRouterModels);
aiRouter.get('/models/groq', listGroqModels);
aiRouter.post('/image/analyze', analyzeImage);
aiRouter.get('/image/list', listUserImages);
aiRouter.delete('/image', deleteUserImage);
aiRouter.post('/voice/tts', tts);
aiRouter.post('/voice/stt', stt);
aiRouter.post('/voice/webrtc-token', elevenlabsWebRTCToken);
