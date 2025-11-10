import { Response, NextFunction } from 'express';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import createError from 'http-errors';
import { AuthenticatedRequest } from '../middleware/auth';
import { ConversationModel } from '../models/Conversation';
import { MessageModel } from '../models/Message';
import { env } from '../config/env';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenRouterClient, getOpenRouterModelId } from '../ai/openrouterProvider';
import { streamText, generateText } from 'ai';
import { serpSearch, serpGoogleLightSearch, serpGoogleNewsLightSearch, renderCitations, WebResult } from '../services/serpapi';

// Load system prompt from file with fallback
const SYSTEM_PROMPT: string = (() => {
  const candidates = [
    // Build output relative to compiled file
    path.resolve(__dirname, '../prompts/system.md'),
    // Monorepo/workspace execution from project root (ts-node/dev)
    path.resolve(process.cwd(), 'backend/src/prompts/system.md'),
    // Possible dist prompt alongside compiled output
    path.resolve(process.cwd(), 'backend/dist/prompts/system.md'),
  ];
  for (const p of candidates) {
    try {
      if (existsSync(p)) {
        return readFileSync(p, 'utf8');
      }
    } catch {}
  }
  return 'You are a helpful assistant.';
})();

// Load web search prompt for query optimization
const WEBSEARCH_PROMPT: string = (() => {
  const candidates = [
    path.resolve(__dirname, '../prompts/websearch.md'),
    path.resolve(process.cwd(), 'backend/src/prompts/websearch.md'),
    path.resolve(process.cwd(), 'backend/dist/prompts/websearch.md'),
  ];
  for (const p of candidates) {
    try {
      if (existsSync(p)) {
        return readFileSync(p, 'utf8');
      }
    } catch {}
  }
  return 'Output a concise, precise web search query string for the user request. No extra words.';
})();

// POST /api/ai/title
// body: { conversationId: string }
export async function generateConversationTitle(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { conversationId } = req.body as { conversationId?: string };
    if (!conversationId) {
      throw createError(400, 'conversationId is required');
    }

    const conv = await ConversationModel.findOne({ _id: conversationId, userId });
    if (!conv) throw createError(404, 'Conversation not found');

    // If the title already looks custom (not default), we can still allow regeneration but it's fine.
    const msgs = await MessageModel.find({ conversationId, userId })
      .sort({ createdAt: 1 })
      .lean();

    const combined = msgs
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n')
      .slice(0, 8000); // keep prompt bounded

    const provider = (req.body?.provider as 'gemini' | 'openrouter' | undefined) || env.AI_PROVIDER;
    let modelId: string;
    let openAIProvider: ReturnType<typeof createOpenAI>;

    if (provider === 'openrouter') {
      openAIProvider = createOpenRouterClient();
      modelId = getOpenRouterModelId();
    } else {
      const baseURL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
      modelId = (env as any).GEMINI_MODEL || 'gemini-2.0-flash';
      openAIProvider = createOpenAI({ apiKey: env.GEMINI_API_KEY, baseURL });
    }

    const system = `You generate ultra-concise chat titles.
Rules:
- 2 or 3 words maximum.
- Title case.
- No punctuation, no quotes, no emojis.
- Capture the main topic of the conversation.
Return only the title.`;

    let title = '';
    try {
      const { text } = await generateText({
        model: openAIProvider.chat(modelId),
        system: system,
        messages: [
          { role: 'user', content: `Conversation transcript (truncated):\n\n${combined}` },
        ],
      });
      title = (text || '').trim();
    } catch (err) {
      // Swallow rate limit and other transient errors, we'll compute a heuristic fallback below.
      title = '';
    }
    // Post-process: strip quotes/punctuation and enforce shortness
    title = title
      .replace(/^"|"$/g, '')
      .replace(/[.,;:!?\-_/\\()[\]{}"'`~*@#%^&+=|<>]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Fallbacks
    if (!title) {
      const firstUser = msgs.find((m) => m.role === 'user')?.content || 'New Chat';
      title = (firstUser.length > 30 ? firstUser.slice(0, 30) + '…' : firstUser).trim();
    }

    // Ensure max 3 words
    const words = title.split(' ').filter(Boolean).slice(0, 3);
    title = words
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    conv.title = title || conv.title;
    await conv.save();

    res.json({ title: conv.title });
  } catch (err) {
    next(err);
  }
}

// POST /api/ai/stream
// body: { conversationId?: string, message: string }
export async function streamAIResponse(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { conversationId, message, webSearch } = req.body as { conversationId?: string; message: string; webSearch?: boolean };
    if (!message) throw createError(400, 'Message is required');

    let convId = conversationId;
    if (convId) {
      const conv = await ConversationModel.findOne({ _id: convId, userId }).lean();
      if (!conv) throw createError(404, 'Conversation not found');
    } else {
      const title = message.length > 60 ? message.slice(0, 60) + '…' : message;
      const conv = await ConversationModel.create({ userId, title: title || 'New Chat' });
      convId = conv._id.toString();
    }

    // Save user message
    await MessageModel.create({ conversationId: convId, userId, role: 'user', content: message });

    // Select provider (Gemini default) or OpenRouter via OpenAI-compatible SDK
    const provider = (req.body as any)?.provider as 'gemini' | 'openrouter' | undefined || env.AI_PROVIDER;
    let modelId: string;
    let openAIProvider: ReturnType<typeof createOpenAI>;
    if (provider === 'openrouter') {
      openAIProvider = createOpenRouterClient();
      modelId = getOpenRouterModelId();
    } else {
      const baseURL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
      modelId = (env as any).GEMINI_MODEL || 'gemini-2.0-flash';
      openAIProvider = createOpenAI({ apiKey: env.GEMINI_API_KEY, baseURL });
    }

    let response;
    let webResults: { id: number; title: string; link: string; source?: string; favicon?: string; date?: string; snippet?: string }[] | undefined;
    let webSummary: string | undefined;
    let researchBrief: string | undefined;
    try {
      // Fetch full conversation history and include it for context (limited to recent turns for safety)
      const history = await MessageModel.find({ conversationId: convId, userId })
        .sort({ createdAt: 1 })
        .lean();

      // Keep a larger recent window, trimmed by a rough character budget to preserve context
      const MAX_TURNS = 100;
      const approxBudget = 16000; // chars; model/token dependent, safe heuristic
      const recent = history.slice(Math.max(0, history.length - MAX_TURNS));
      const reversed = [...recent].reverse();
      const kept: { role: 'user' | 'assistant'; content: string }[] = [];
      let acc = 0;
      for (const m of reversed) {
        const text = m.content || '';
        const len = text.length;
        if (acc + len > approxBudget) break;
        kept.push({ role: m.role as 'user' | 'assistant', content: text });
        acc += len;
      }
      kept.reverse();
      const chatMessages = kept;

      const extra: any = {};
      if (provider === 'openrouter') {
        // Help OpenRouter attribute per-conversation usage and enable transform to retain salient history
        extra.user = `${userId}:${convId}`; // stable user+conversation key
        extra.transforms = ['middle-out'];
      }

      // Optional: perform web search to augment context
      let augmentedSystem = SYSTEM_PROMPT;
      if (webSearch && env.SERPAPI_KEY) {
        try {
          // Plan multiple targeted queries
          const { text: planText } = await generateText({
            model: openAIProvider.chat(modelId),
            system: `Return 3-6 high-quality web search queries as a JSON array of objects with fields {query, type, reason}. Types may include: general, definition, howto, docs, api, comparison, news, biography, timeline, stats. Tailor to the user's request. Keep queries concise. No prose, only JSON array.`,
            messages: [
              { role: 'user', content: message },
            ],
          });
          let planned: { query: string }[] = [];
          try {
            const parsed = JSON.parse(planText || '[]');
            if (Array.isArray(parsed)) planned = parsed.map((p: any) => ({ query: String(p.query || '').trim() })).filter((p) => p.query);
          } catch {
            // Fallback to single optimized query
            const { text: query } = await generateText({
              model: openAIProvider.chat(modelId),
              system: WEBSEARCH_PROMPT,
              messages: [{ role: 'user', content: message }],
            });
            planned = [{ query: (query || message).trim().slice(0, 300) }];
          }
          if (planned.length === 0) planned = [{ query: message.slice(0, 300) }];

          // Intent: detect news vs general
          const intentIsNews = /\b(news|latest|today|this week|breaking|headline|update|updates)\b/i.test(message);

          // Execute multiple web searches and aggregate results
          const all: WebResult[] = [];
          for (const p of planned.slice(0, 6)) {
            try {
              const batch = intentIsNews
                ? await serpGoogleNewsLightSearch(p.query, { num: 10 })
                : await serpGoogleLightSearch(p.query, { num: 10 });
              all.push(...batch);
            } catch {}
          }
          // Deduplicate by URL host+path and cap per-domain to avoid overload
          const seen = new Set<string>();
          const perDomain: Record<string, number> = {};
          const deduped: WebResult[] = [];
          for (const r of all) {
            try {
              const u = new URL(r.link);
              const key = `${u.hostname}${u.pathname}`;
              const domain = u.hostname;
              if (seen.has(key)) continue;
              if ((perDomain[domain] || 0) >= 3) continue;
              seen.add(key);
              perDomain[domain] = (perDomain[domain] || 0) + 1;
              deduped.push(r);
            } catch {}
          }

          // Save results for SSE so UI can render source icons
          const top = deduped.slice(0, 12);
          webResults = top.map((r, i) => ({
            id: i + 1,
            title: r.title,
            link: r.link,
            source: r.source,
            date: r.date,
            snippet: r.snippet,
            favicon: (() => {
              try {
                const u = new URL(r.link);
                const host = u.hostname;
                // Primary: DuckDuckGo, Fallback: Google S2
                return `https://icons.duckduckgo.com/ip3/${host}.ico`;
              } catch {
                return undefined;
              }
            })(),
          }));

          // Build a concise research brief to ground the model
          try {
            const briefLines = top.slice(0, 8).map((r, i) => {
              const src = r.source || (() => { try { return new URL(r.link).hostname; } catch { return r.link; } })();
              const date = r.date ? ` [${r.date}]` : '';
              const snip = (r.snippet || '').replace(/\s+/g, ' ').trim().slice(0, 220);
              return `(${i + 1}) ${r.title} — ${src}${date}\n${snip}`.trim();
            }).join('\n\n');
            researchBrief = `Web research findings for the user's request. Use ONLY these as factual grounding. Cite inline with (source #) when appropriate.\n\n${briefLines}`;
          } catch {}

          // Create a short findings summary to show before the full answer (for UI)
          try {
            const numbered = top
              .slice(0, 12)
              .map((r, i) => `(${i + 1}) ${r.title} — ${r.source || r.link}${r.date ? ` [${r.date}]` : ''}${r.snippet ? `\nSnippet: ${r.snippet}` : ''}`)
              .join('\n\n');
            const { text: summary } = await generateText({
              model: openAIProvider.chat(modelId),
              system: `You write ultra-concise bullet summaries (3-6 points) strictly from the findings below.
Rules:
- Short, factual bullets. Neutral tone.
- No links, usernames, social handles, or site names in-line.
- No bracketed citations or numbers.
- Prefer consensus across multiple sources; if conflict, note it briefly.
- If evidence is insufficient for a point, omit it.
- No intro/outro.`,
              messages: [
                { role: 'user', content: `Summarize the key findings for the user's query:\n\n${message}\n\nSources:\n${numbered}` },
              ],
            });
            webSummary = (summary || '').trim();
          } catch {}
        } catch {}
      }

      // Assemble model call with optional research brief as a system preface
      const systemParts = [SYSTEM_PROMPT];
      if (researchBrief) {
        systemParts.push('\n\n' + researchBrief);
      }
      const finalSystem = systemParts.join('');

      response = await streamText({
        model: openAIProvider.chat(modelId),
        system: finalSystem,
        messages: chatMessages,
        ...extra,
      });
    } catch (err) {
      // If model call fails before streaming starts, propagate a 502 without sending SSE headers
      return next(createError(502, (err as Error).message));
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let assistantText = '';
    try {
      // Send sources to client before text stream starts
      if (webResults && webResults.length) {
        res.write(`data: ${JSON.stringify({ type: 'sources', sources: webResults })}\n\n`);
      }
      if (webSummary) {
        res.write(`data: ${JSON.stringify({ type: 'webSummary', summary: webSummary })}\n\n`);
      }
      for await (const delta of response.textStream) {
        assistantText += delta;
        res.write(`data: ${JSON.stringify({ type: 'delta', delta })}\n\n`);
      }
    } catch (err) {
      // End SSE stream gracefully on error to avoid double-send
      res.write(`data: ${JSON.stringify({ type: 'error', message: (err as Error).message })}\n\n`);
      res.end();
      return;
    }

    // Persist assistant message with web artifacts (if any)
    if (assistantText.trim()) {
      await MessageModel.create({
        conversationId: convId,
        userId,
        role: 'assistant',
        content: assistantText,
        sources: webResults,
        webSummary: webSummary,
        researchBrief: researchBrief,
      });
    }

    // Notify completion and conversationId for newly created chats
    res.write(`data: ${JSON.stringify({ type: 'done', conversationId: convId })}\n\n`);
    res.end();
  } catch (err) {
    next(err);
  }
}


