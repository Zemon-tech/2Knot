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

export async function serpSearch(query: string, opts?: { num?: number; gl?: string; hl?: string }) {
  if (!env.SERPAPI_KEY) {
    return [] as WebResult[];
  }
  const params = new URLSearchParams({
    engine: 'google',
    q: query,
    api_key: env.SERPAPI_KEY,
    no_cache: 'true',
    num: String(opts?.num ?? 10),
    gl: opts?.gl ?? 'us',
    hl: opts?.hl ?? 'en',
  });
  const url = `https://serpapi.com/search?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) return [] as WebResult[];
  const data = await res.json();
  const organic = Array.isArray(data?.organic_results) ? data.organic_results : [];
  const results: WebResult[] = organic.map((r: any) => ({
    title: r.title as string,
    link: r.link as string,
    snippet: r.snippet as string | undefined,
    date: (r.date || r.date_published) as string | undefined,
    source: (() => {
      try { return new URL(r.link).hostname; } catch { return undefined; }
    })(),
  }));

  const trusted = results.filter((r) => isTrusted(r.link));
  const fallback = trusted.length ? trusted : results;
  return fallback.slice(0, 8);
}

export function renderCitations(results: WebResult[]): string {
  if (!results.length) return '';
  const lines = results.slice(0, 5).map((r, i) => `(${i + 1}) ${r.title} — ${r.source || r.link}`);
  return `\n\nWeb sources (use carefully):\n${lines.join('\n')}`;
}
