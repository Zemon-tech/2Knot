import { env } from '../config/env';

export type WebResult = {
  title: string;
  link: string;
  snippet?: string;
  source?: string;
  date?: string;
};

const TRUSTED_TLDS = ['.gov', '.edu'];
const TRUSTED_DOMAINS = [
  'www.nature.com',
  'www.sciencedirect.com',
  'arxiv.org',
  'www.nhs.uk',
  'www.mayoclinic.org',
  'www.bmj.com',
  'www.nytimes.com',
  'www.bbc.com',
  'www.who.int',
  'www.cdc.gov',
  'www.whitehouse.gov',
  'data.gov',
  'developer.mozilla.org',
  'docs.python.org',
  'nodejs.org',
  'khanacademy.org',
  'stanford.edu',
  'mit.edu',
];

function isTrusted(url: string) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (TRUSTED_TLDS.some((tld) => host.endsWith(tld))) return true;
    if (TRUSTED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) return true;
    return false;
  } catch {
    return false;
  }
}

type BaseOpts = { num?: number; gl?: string; hl?: string; start?: number };

async function callSerp(params: Record<string, string>) {
  if (!env.SERPAPI_KEY) return null;
  const search = new URLSearchParams({ api_key: env.SERPAPI_KEY, no_cache: 'true', ...params });
  const url = `https://serpapi.com/search?${search.toString()}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  try { return await res.json(); } catch { return null; }
}

function normalizeOrganic(organic: any[]): WebResult[] {
  const results: WebResult[] = (organic || [])
    .map((r: any) => ({
      title: String(r.title || ''),
      link: String(r.link || ''),
      snippet: (r.snippet || r.snippet_highlighted_words?.join(' ')) as string | undefined,
      date: (r.date || r.date_published || r.snippet_date) as string | undefined,
      source: (() => {
        try { return new URL(r.link).hostname; } catch { return undefined; }
      })(),
    }))
    .filter((r: WebResult) => {
      try {
        if (!r.title || !r.link) return false;
        if (r.link.toLowerCase().includes('blocked')) return false;
        const u = new URL(r.link);
        if (!/^https?:$/.test(u.protocol)) return false;
        return !!u.hostname;
      } catch {
        return false;
      }
    });
  const trusted = results.filter((r) => isTrusted(r.link));
  return (trusted.length ? trusted : results).slice(0, 10);
}

export async function serpGoogleLightSearch(query: string, opts?: BaseOpts) {
  const data = await callSerp({
    engine: 'google_light',
    q: query,
    num: String(opts?.num ?? 10),
    gl: opts?.gl ?? 'us',
    hl: opts?.hl ?? 'en',
    start: String(opts?.start ?? 0),
  });
  if (!data) return [] as WebResult[];
  const organic = Array.isArray(data?.organic_results) ? data.organic_results : [];
  return normalizeOrganic(organic);
}

export async function serpGoogleNewsLightSearch(query: string, opts?: BaseOpts) {
  const data = await callSerp({
    engine: 'google_news_light',
    q: query,
    num: String(opts?.num ?? 10),
    gl: opts?.gl ?? 'us',
    hl: opts?.hl ?? 'en',
    start: String(opts?.start ?? 0),
  });
  if (!data) return [] as WebResult[];
  const news = Array.isArray(data?.news_results) ? data.news_results : Array.isArray(data?.organic_results) ? data.organic_results : [];
  return normalizeOrganic(news);
}

// Backward-compatible default search using standard Google engine
export async function serpSearch(query: string, opts?: { num?: number; gl?: string; hl?: string }) {
  const data = await callSerp({
    engine: 'google',
    q: query,
    num: String(opts?.num ?? 10),
    gl: opts?.gl ?? 'us',
    hl: opts?.hl ?? 'en',
  });
  if (!data) return [] as WebResult[];
  const organic = Array.isArray(data?.organic_results) ? data.organic_results : [];
  return normalizeOrganic(organic).slice(0, 8);
}

export function renderCitations(results: WebResult[]): string {
  if (!results.length) return '';
  const lines = results.slice(0, 5).map((r, i) => `(${i + 1}) ${r.title} — ${r.source || r.link}`);
  return `\n\nWeb sources (use carefully):\n${lines.join('\n')}`;
}
