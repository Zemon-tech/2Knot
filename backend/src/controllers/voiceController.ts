import { Request, Response, NextFunction } from 'express';
import createError from 'http-errors';
import { env } from '../config/env';

function b64ToBuffer(b64: string): Buffer {
  const comma = b64.indexOf(',');
  const data = comma >= 0 ? b64.slice(comma + 1) : b64;
  return Buffer.from(data, 'base64');
}

export async function elevenlabsWebRTCToken(req: Request, res: Response, next: NextFunction) {
  try {
    const xiKey = env.ELEVEN_API_KEY;
    if (!xiKey) throw createError(500, 'ELEVEN_API_KEY not configured');

    const { agentId, voiceId } = (req.body || {}) as { agentId?: string; voiceId?: string };
    const useAgent = agentId || env.ELEVEN_AGENT_ID || '';
    const useVoice = voiceId || env.ELEVEN_VOICE_ID || '';

    const query: string[] = [];
    if (useAgent) query.push(`agent_id=${encodeURIComponent(useAgent)}`);
    if (useVoice) query.push(`voice_id=${encodeURIComponent(useVoice)}`);
    const qs = query.length ? `?${query.join('&')}` : '';

    const url = `https://api.elevenlabs.io/v1/convai/conversation/get-webrtc-token${qs}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': xiKey,
        'Accept': 'application/json',
      },
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      throw createError(r.status, `ElevenLabs token failed: ${errText || r.statusText}`);
    }
    const data = await r.json();
    // Expected: { token: string, expires_at?: string }
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function tts(req: Request, res: Response, next: NextFunction) {
  try {
    const { text, voiceId, modelId, outputFormat } = (req.body || {}) as {
      text?: string;
      voiceId?: string;
      modelId?: string;
      outputFormat?: string; 
    };
    if (!text || !text.trim()) throw createError(400, 'text is required');

    const xiKey = env.ELEVEN_API_KEY;
    if (!xiKey) throw createError(500, 'ELEVEN_API_KEY not configured');

    const vId = voiceId || env.ELEVEN_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; 
    const model = modelId || env.ELEVEN_TTS_MODEL || 'eleven_turbo_v2_5';
    const format = outputFormat || 'mp3_44100_128';

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(vId)}?output_format=${encodeURIComponent(format)}`;
    const body = {
      text: text.slice(0, 4000),
      model_id: model,
      voice_settings: undefined,
    } as any;

    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': xiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      throw createError(r.status, `ElevenLabs TTS failed: ${errText || r.statusText}`);
    }
    const arrayBuf = await r.arrayBuffer();
    const buf = Buffer.from(arrayBuf);
    const b64 = buf.toString('base64');
    res.json({ audioBase64: `data:audio/mpeg;base64,${b64}` });
  } catch (err) {
    next(err);
  }
}

export async function stt(req: Request, res: Response, next: NextFunction) {
  try {
    const { audioBase64, mimeType, language_code } = (req.body || {}) as {
      audioBase64?: string;
      mimeType?: string;
      language_code?: string;
    };
    if (!audioBase64) throw createError(400, 'audioBase64 is required');
    const xiKey = env.ELEVEN_API_KEY;
    if (!xiKey) throw createError(500, 'ELEVEN_API_KEY not configured');

    const model = env.ELEVEN_STT_MODEL || 'scribe_v1';

    const buffer = b64ToBuffer(audioBase64);
    const filename = 'audio.webm';

    let form: any;
    try {
      const G: any = global as any;
      form = new G.FormData();
      form.append('model_id', model);
      if (language_code) form.append('language_code', language_code);
      form.append('file', new G.Blob([buffer], { type: mimeType || 'audio/webm' }), filename);
    } catch {
      const G: any = global as any;
      form = new G.FormData();
      form.append('model_id', model);
      if (language_code) {
        form.append('language_code', language_code);
      }
      form.append('file', new (global as any).Blob([buffer], { type: mimeType || 'audio/webm' }), filename);
    }

    const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': xiKey,
      },
      body: form,
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      throw createError(r.status, `ElevenLabs STT failed: ${errText || r.statusText}`);
    }
    const data = await r.json();
    const text: string = (data?.text as string) || (Array.isArray(data?.transcripts) ? data.transcripts.map((t: any) => t.text).join('\n') : '');
    res.json({ text });
  } catch (err) {
    next(err);
  }
}
