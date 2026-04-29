// Thin Google Places client — Find Place + Place Details (reviews).
// Requires GOOGLE_PLACES_API_KEY env var.

const FIND_PLACE = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json';
const PLACE_DETAILS = 'https://maps.googleapis.com/maps/api/place/details/json';

export type PlaceReview = {
  author_name: string;
  rating: number;
  text: string;
  time: number; // unix seconds
  relative_time_description?: string;
  profile_photo_url?: string;
  language?: string;
};

export type PlaceDetails = {
  place_id: string;
  name: string;
  formatted_address?: string;
  rating?: number;
  user_ratings_total?: number;
  reviews: PlaceReview[];
  website?: string;
  url?: string;
  types?: string[];
  formatted_phone_number?: string;
  international_phone_number?: string;
};

const KEY = () => {
  const k = process.env.GOOGLE_PLACES_API_KEY;
  if (!k) throw new Error('GOOGLE_PLACES_API_KEY not configured.');
  return k;
};

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

async function findPlaceByText(query: string): Promise<string | null> {
  if (!query || query.length < 3) return null;
  const params = new URLSearchParams({
    input: query.slice(0, 200),
    inputtype: 'textquery',
    fields: 'place_id,name',
    key: KEY(),
  });
  const r = await fetch(`${FIND_PLACE}?${params.toString()}`, {
    signal: AbortSignal.timeout(10000),
  });
  const data = await r.json();
  if (data.status !== 'OK' || !data.candidates?.length) return null;
  return data.candidates[0].place_id as string;
}

function extractRestaurantClue(html: string): string[] {
  const out: string[] = [];
  const title = (html.match(/<title>([^<]*)<\/title>/i)?.[1] || '').trim();
  if (title) {
    // "Chimba | Miami's Best Colombian Restaurant" -> ["Chimba | Miami's Best Colombian Restaurant", "Chimba"]
    out.push(title);
    const head = title.split(/[|·\-—–]/)[0].trim();
    if (head && head !== title) out.push(head);
  }
  const ogSite = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)/i)?.[1];
  if (ogSite) out.push(ogSite.trim());
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1];
  if (ogTitle) out.push(ogTitle.trim());
  const desc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)?.[1];
  if (desc) out.push(desc.trim().slice(0, 120));
  // Schema.org Restaurant name
  const ldJson = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
  if (ldJson) {
    try {
      const obj = JSON.parse(ldJson.trim());
      const arr = Array.isArray(obj) ? obj : [obj];
      for (const o of arr) {
        if (o?.name && (o['@type'] === 'Restaurant' || o['@type'] === 'LocalBusiness' || o['@type'] === 'Organization')) {
          out.push(o.name);
          if (o.address?.addressLocality) out.push(`${o.name} ${o.address.addressLocality}`);
        }
      }
    } catch {}
  }
  return Array.from(new Set(out.filter(Boolean)));
}

export async function findPlaceByWebsite(websiteUrl: string): Promise<string | null> {
  const host = hostFromUrl(websiteUrl);

  // Strategy 1: try the bare hostname (works for popular places)
  const byHost = await findPlaceByText(host).catch(() => null);
  if (byHost) return byHost;

  // Strategy 2: try a "host without TLD" — chimbamiami.com → "chimba miami"
  const guess = host
    .replace(/\.(com|net|org|co|us|io|app|biz|cafe|menu|kitchen|restaurant)$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  if (guess && guess !== host) {
    const byGuess = await findPlaceByText(guess).catch(() => null);
    if (byGuess) return byGuess;
  }

  // Strategy 3: fetch the page, scrape clues (title, og:site_name, JSON-LD), retry
  try {
    const r = await fetch(websiteUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    });
    const html = await r.text();
    const clues = extractRestaurantClue(html);
    for (const c of clues) {
      const id = await findPlaceByText(c).catch(() => null);
      if (id) return id;
    }
  } catch {}

  return null;
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  const params = new URLSearchParams({
    place_id: placeId,
    fields: [
      'place_id',
      'name',
      'formatted_address',
      'rating',
      'user_ratings_total',
      'reviews',
      'website',
      'url',
      'types',
      'formatted_phone_number',
      'international_phone_number',
    ].join(','),
    reviews_no_translations: 'true',
    reviews_sort: 'newest',
    key: KEY(),
  });
  const r = await fetch(`${PLACE_DETAILS}?${params.toString()}`, {
    signal: AbortSignal.timeout(12000),
  });
  const data = await r.json();
  if (data.status !== 'OK') {
    throw new Error(`Places API error: ${data.status}${data.error_message ? ` — ${data.error_message}` : ''}`);
  }
  const result = data.result || {};
  return {
    place_id: result.place_id || placeId,
    name: result.name || '',
    formatted_address: result.formatted_address,
    rating: result.rating,
    user_ratings_total: result.user_ratings_total,
    reviews: result.reviews || [],
    website: result.website,
    url: result.url,
    types: result.types,
    formatted_phone_number: result.formatted_phone_number,
    international_phone_number: result.international_phone_number,
  };
}

export async function getNearbyCompetitors(
  placeId: string,
  type: string = 'restaurant'
): Promise<Array<{ place_id: string; name: string; rating?: number; user_ratings_total?: number }>> {
  // For v1: nearby search around the same place. Returns top competitors by rating.
  const detailsParams = new URLSearchParams({
    place_id: placeId,
    fields: 'geometry/location',
    key: KEY(),
  });
  const r1 = await fetch(`${PLACE_DETAILS}?${detailsParams.toString()}`, {
    signal: AbortSignal.timeout(10000),
  });
  const d1 = await r1.json();
  const loc = d1?.result?.geometry?.location;
  if (!loc) return [];
  const nearbyParams = new URLSearchParams({
    location: `${loc.lat},${loc.lng}`,
    radius: '1500',
    type,
    key: KEY(),
  });
  const r2 = await fetch(
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${nearbyParams.toString()}`,
    { signal: AbortSignal.timeout(12000) }
  );
  const d2 = await r2.json();
  if (d2.status !== 'OK') return [];
  return (d2.results || [])
    .filter((p: any) => p.place_id !== placeId)
    .slice(0, 5)
    .map((p: any) => ({
      place_id: p.place_id,
      name: p.name,
      rating: p.rating,
      user_ratings_total: p.user_ratings_total,
    }));
}
