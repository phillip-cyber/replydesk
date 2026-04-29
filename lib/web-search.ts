// Minimal web search for LinkedIn URLs. Tries DuckDuckGo HTML (free, no key)
// then Brave Search API (if BRAVE_API_KEY is set).

const DDG_HTML = 'https://html.duckduckgo.com/html/';
const BRAVE = 'https://api.search.brave.com/res/v1/web/search';
const LINKEDIN_IN_RE = /https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/g;

export type SearchHit = { url: string; title: string; snippet: string };

async function ddgSearch(query: string): Promise<SearchHit[]> {
  try {
    const r = await fetch(DDG_HTML, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      },
      body: new URLSearchParams({ q: query }).toString(),
      signal: AbortSignal.timeout(10000),
    });
    const html = await r.text();
    // Parse result blocks: <a class="result__a" href="/l/?uddg=ENCODED_URL"...
    const results: SearchHit[] = [];
    const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      let url = m[1];
      // DDG uses redirect URLs like /l/?uddg=https...
      const uddg = url.match(/uddg=([^&]+)/);
      if (uddg) url = decodeURIComponent(uddg[1]);
      const title = m[2].replace(/<[^>]+>/g, '').trim();
      const snippet = m[3].replace(/<[^>]+>/g, '').trim();
      results.push({ url, title, snippet });
      if (results.length >= 10) break;
    }
    if (results.length === 0) {
      // Fallback to extracting any linkedin.com/in URL directly from the HTML
      const direct = Array.from(html.matchAll(LINKEDIN_IN_RE)).map((m) => m[0]);
      for (const u of direct.slice(0, 10)) {
        results.push({ url: u, title: '', snippet: '' });
      }
    }
    return results;
  } catch {
    return [];
  }
}

async function braveSearch(query: string): Promise<SearchHit[]> {
  const key = process.env.BRAVE_API_KEY;
  if (!key) return [];
  try {
    const params = new URLSearchParams({ q: query, count: '10', country: 'us' });
    const r = await fetch(`${BRAVE}?${params.toString()}`, {
      headers: { 'X-Subscription-Token': key, Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    const data = await r.json();
    const items = data?.web?.results || [];
    return items.map((i: any) => ({
      url: i.url || '',
      title: i.title || '',
      snippet: i.description || '',
    }));
  } catch {
    return [];
  }
}

export async function webSearch(query: string): Promise<SearchHit[]> {
  // Prefer Brave when configured, fall back to DDG
  const brave = await braveSearch(query);
  if (brave.length > 0) return brave;
  return ddgSearch(query);
}

export async function findOwnerLinkedin(
  restaurantName: string,
  city: string,
  state: string
): Promise<string | null> {
  const queries = [
    `${restaurantName} ${city} owner founder site:linkedin.com/in`,
    `${restaurantName} ${city} chef partner site:linkedin.com/in`,
    `"${restaurantName}" ${city} ${state} site:linkedin.com/in`,
  ];
  for (const q of queries) {
    const results = await webSearch(q);
    // Pick the first result that's actually a /in/ profile URL
    for (const r of results) {
      const m = r.url.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/);
      if (m) return m[0];
    }
  }
  return null;
}
