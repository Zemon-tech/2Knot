import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth';
import { listADKAgents, sendADKMessage, checkADKHealth, streamADKMessage } from '../controllers/adkController';

export const adkRouter = Router();

adkRouter.use(requireAuth);

// Rate limiting for ADK endpoints
const adkRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each user to 100 requests per windowMs
  message: 'Too many ADK requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

adkRouter.get('/health', checkADKHealth);
adkRouter.get('/agents', adkRateLimiter, listADKAgents);
adkRouter.post('/message', adkRateLimiter, sendADKMessage);
adkRouter.post('/stream', adkRateLimiter, streamADKMessage);

