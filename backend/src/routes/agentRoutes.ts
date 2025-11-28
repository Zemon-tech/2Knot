import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { listAgents, createAgent, updateAgent, deleteAgent } from '../controllers/agentController';

export const agentRouter = Router();

agentRouter.use(requireAuth);
agentRouter.get('/', listAgents);
agentRouter.post('/', createAgent);
agentRouter.patch('/:id', updateAgent);
agentRouter.delete('/:id', deleteAgent);
