import { Router } from 'express';
import { authRouter } from './authRoutes';
import { conversationRouter } from './conversationRoutes';
import { aiRouter } from './aiRoutes';
import { agentRouter } from './agentRoutes';
import { adkRouter } from './adkRoutes';

export const router = Router();

router.use('/auth', authRouter);
router.use('/conversations', conversationRouter);
router.use('/ai', aiRouter);
router.use('/agents', agentRouter);
router.use('/adk', adkRouter);
router.get('/', (_req, res) => {
  res.json({ ok: true, message: 'API root' });
});
