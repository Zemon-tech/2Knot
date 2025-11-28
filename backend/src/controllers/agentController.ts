import { Response, NextFunction } from 'express';
import createError from 'http-errors';
import { AuthenticatedRequest } from '../middleware/auth';
import { AgentModel } from '../models/Agent';

export async function listAgents(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const agents = await AgentModel.find({ userId }).sort({ createdAt: 1 }).lean();
    res.json({ agents });
  } catch (err) {
    next(err);
  }
}

export async function createAgent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { name, description, systemPrompt } = req.body as {
      name?: string;
      description?: string;
      systemPrompt?: string;
    };
    if (!name || !systemPrompt) {
      throw createError(400, 'name and systemPrompt are required');
    }

    const baseSlug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'agent';
    let slug = baseSlug;
    let counter = 1;
    // Ensure per-user uniqueness
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existing = await AgentModel.findOne({ userId, slug }).lean();
      if (!existing) break;
      counter += 1;
      slug = `${baseSlug}-${counter}`;
    }

    const agent = await AgentModel.create({ userId, name, slug, description, systemPrompt });
    res.status(201).json({ agent });
  } catch (err) {
    next(err);
  }
}

export async function updateAgent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { id } = req.params as { id: string };
    const { name, description, systemPrompt } = req.body as {
      name?: string;
      description?: string;
      systemPrompt?: string;
    };

    const update: Record<string, unknown> = {};
    if (typeof name === 'string') update.name = name;
    if (typeof description === 'string') update.description = description;
    if (typeof systemPrompt === 'string') update.systemPrompt = systemPrompt;

    const agent = await AgentModel.findOneAndUpdate({ _id: id, userId }, { $set: update }, { new: true });
    if (!agent) throw createError(404, 'Agent not found');
    res.json({ agent });
  } catch (err) {
    next(err);
  }
}

export async function deleteAgent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { id } = req.params as { id: string };
    const agent = await AgentModel.findOneAndDelete({ _id: id, userId });
    if (!agent) throw createError(404, 'Agent not found');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
