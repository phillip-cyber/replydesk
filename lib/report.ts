// Reusable report generation — used by /api/preview, /api/checkout/verify, and /api/cron/refresh.
import Anthropic from '@anthropic-ai/sdk';
import { findPlaceByWebsite, getPlaceDetails, getNearbyCompetitors, type PlaceDetails } from './google-places';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

export const ANALYSIS_SYSTEM = `You are the Bloom AI team — five named agents (Iris, Echo, Atlas, Sage, Argus) analyzing Google reviews for a single restaurant or café.

You receive: restaurant name + address + recent reviews + nearby competitors.

OUTPUT ONLY VALID JSON. No commentary. No markdown fences. Start with { and end with }.

Schema (output exactly these keys):
{
  "overallSentiment": "positive" | "mixed" | "negative",
  "positiveThemes": [string],
  "negativeThemes": [string],
  "emergingPatterns": [string],
  "echoSampleReply": { "reviewSnippet": string, "reply": string } | null,
  "atlasActionItems": [string],
  "sageMenuMentions": [{"dish": string, "sentiment": "positive"|"mixed"|"negative", "mentions": number}],
  "argusCompetitors": [{"name": string, "rating": number, "totalReviews": number, "takeaway": string}],
  "reviews": [{
    "id": string,
    "author": string,
    "rating": number,
    "text": string,
    "time": number,
    "agent": "iris" | "echo" | "atlas" | "sage" | "argus",
    "sentiment": "positive" | "mixed" | "negative",
    "themes": [string],
    "draftedReply": string,
    "status": "new"
  }]
}

Echo (drafts replies):
- Warm, plainspoken, founder-tone. Reference SPECIFIC things the reviewer mentioned.
- Never "Thank you for your feedback" or generic openers.
- Negative reviews: acknowledge, take responsibility, invite back.
- Sign off "— The team at [restaurant name]" if no owner name is known.
- Under 75 words.

Atlas (action items):
- Plainspoken. Specific. Tactical. e.g., "Slow service flagged 3x in last 10 reviews. Investigate Tuesday lunch shift."

Sage (menu mentions):
- Only dishes mentioned by name. Don't invent.

Argus (competitor takeaways):
- One-line insight per competitor.

Agent assignment per review:
- rating <= 2 OR negative → "echo"
- mentions a specific dish → "sage"
- mentions service/wait/staff → "atlas"
- rating >= 4 generic positive → "echo"
- default → "iris"`;

export type ReportPayload = {
  placeId: string;
  placeName: string;
  address?: string;
  rating?: number;
  totalReviews?: number;
  websiteResolved?: string;
  googleMapsUrl?: string;
  reviewsUrl?: string;
  overallSentiment: 'positive' | 'mixed' | 'negative';
  positiveThemes: string[];
  negativeThemes: string[];
  emergingPatterns: string[];
  echoSampleReply: { reviewSnippet: string; reply: string } | null;
  echoSampleReplySource: any;
  atlasActionItems: string[];
  sageMenuMentions: { dish: string; sentiment: string; mentions: number }[];
  argusCompetitors: { name: string; rating?: number; totalReviews?: number; takeaway: string }[];
  reviews: any[];
  generatedAt: number;
};

function attachReviewLink(found: any, placeId: string): string | null {
  const authorUrl = found.author_url || null;
  if (authorUrl) {
    const m = String(authorUrl).match(/\/contrib\/(\d+)/);
    if (m) return `https://www.google.com/maps/contrib/${m[1]}/place/${placeId}`;
  }
  return null;
}

export async function generateReport(websiteUrl: string): Promise<ReportPayload> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured.');
  if (!process.env.GOOGLE_PLACES_API_KEY) throw new Error('GOOGLE_PLACES_API_KEY not configured.');

  const placeId = await findPlaceByWebsite(websiteUrl);
  if (!placeId) throw new Error(`Couldn't match ${websiteUrl} to a Google Business Profile.`);

  return generateReportForPlaceId(placeId, websiteUrl);
}

export async function generateReportForPlaceId(
  placeId: string,
  websiteUrl?: string
): Promise<ReportPayload> {
  const details = await getPlaceDetails(placeId);
  if (!details.reviews || details.reviews.length === 0) {
    throw new Error(`${details.name || 'This place'} has no reviews on Google yet.`);
  }
  const competitors = await getNearbyCompetitors(placeId, 'restaurant').catch(() => []);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const userPrompt = JSON.stringify({
    restaurant: {
      name: details.name,
      address: details.formatted_address,
      rating: details.rating,
      totalReviews: details.user_ratings_total,
    },
    reviews: details.reviews.map((r) => ({
      author: r.author_name,
      rating: r.rating,
      text: r.text,
      time: r.time,
      relativeTime: r.relative_time_description,
    })),
    competitors: competitors.map((c) => ({
      name: c.name,
      rating: c.rating,
      totalReviews: c.user_ratings_total,
    })),
  });

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: ANALYSIS_SYSTEM,
    messages: [{ role: 'user', content: userPrompt }],
  });
  const text = resp.content
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('')
    .trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Analysis came back malformed.');
  const analysis = JSON.parse(jsonMatch[0]);

  // Attach review link
  let echoSampleReplySource: any = null;
  if (analysis.echoSampleReply?.reviewSnippet) {
    const snippet = (analysis.echoSampleReply.reviewSnippet as string).toLowerCase().slice(0, 60);
    const found = details.reviews.find((r) => {
      const t = (r.text || '').toLowerCase();
      return t.includes(snippet) || snippet.includes(t.slice(0, 60));
    });
    if (found) {
      const reviewLink =
        attachReviewLink(found, details.place_id) ||
        `https://www.google.com/search?q=${encodeURIComponent(`${found.author_name} ${details.name} review`)}`;
      echoSampleReplySource = {
        authorName: found.author_name,
        authorUrl: (found as any).author_url || null,
        reviewLink,
        rating: found.rating,
        time: found.time,
        relativeTime: found.relative_time_description || null,
        fullText: found.text,
      };
    }
  }

  // Attach a per-review reviewLink for the dashboard CRM
  const reviewsWithLinks = (analysis.reviews || []).map((r: any) => {
    const match = details.reviews.find(
      (g) => g.author_name === r.author && Math.abs(g.time - r.time) < 86400
    );
    const reviewLink = match ? attachReviewLink(match, details.place_id) : null;
    return { ...r, reviewLink, authorUrl: (match as any)?.author_url || null };
  });

  return {
    placeId: details.place_id,
    placeName: details.name,
    address: details.formatted_address,
    rating: details.rating,
    totalReviews: details.user_ratings_total,
    websiteResolved: details.website || websiteUrl,
    googleMapsUrl: details.url || `https://www.google.com/maps/place/?q=place_id:${details.place_id}`,
    reviewsUrl: `https://search.google.com/local/reviews?placeid=${details.place_id}`,
    overallSentiment: analysis.overallSentiment || 'mixed',
    positiveThemes: analysis.positiveThemes || [],
    negativeThemes: analysis.negativeThemes || [],
    emergingPatterns: analysis.emergingPatterns || [],
    echoSampleReply: analysis.echoSampleReply || null,
    echoSampleReplySource,
    atlasActionItems: analysis.atlasActionItems || [],
    sageMenuMentions: analysis.sageMenuMentions || [],
    argusCompetitors: analysis.argusCompetitors || [],
    reviews: reviewsWithLinks,
    generatedAt: Date.now(),
  };
}
