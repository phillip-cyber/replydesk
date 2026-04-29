import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { Lead } from '@/lib/types';
import { findOwnerLinkedin } from '@/lib/web-search';

export const runtime = 'nodejs';
export const maxDuration = 60;

const GENERIC_EMAIL_RE = /^(info|hello|contact|support|hi|admin|team|inquiries|reservations|booking|press|media)@/i;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const LINKEDIN_RE = /https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/g;

function isGeneric(email: string): boolean {
  return GENERIC_EMAIL_RE.test(email);
}

function uniq<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}

async function fetchSafely(url: string, ms = 10000): Promise<string> {
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(ms),
    });
    return await r.text();
  } catch {
    return '';
  }
}

async function enrichOne(lead: Lead): Promise<Partial<Lead>> {
  if (!lead.website) return {};

  // Fetch homepage + likely about/team/contact pages
  const home = await fetchSafely(lead.website);
  let combined = home;
  const links = Array.from(
    home.matchAll(/href=["']([^"']*(about|team|contact|owners?|founders?|story|chef|people)[^"']*)["']/gi)
  )
    .map((m) => m[1])
    .filter((href) => href && !href.startsWith('mailto:') && !href.startsWith('tel:'))
    .slice(0, 4);

  for (const link of links) {
    try {
      const u = new URL(link, lead.website).toString();
      const more = await fetchSafely(u, 8000);
      if (more) combined += '\n\n---\n\n' + more.slice(0, 30000);
    } catch {}
  }

  // Regex-extract emails + LinkedIns directly (cheap, comprehensive)
  const rawEmails = uniq(
    Array.from(combined.matchAll(EMAIL_RE))
      .map((m) => m[0].toLowerCase())
      .filter((e) => !e.endsWith('.png') && !e.endsWith('.jpg') && !e.includes('sentry') && !e.includes('wixpress'))
  ).slice(0, 12);
  const rawLinkedIns = uniq(Array.from(combined.matchAll(LINKEDIN_RE)).map((m) => m[0])).slice(0, 5);

  // Use Claude only to identify the owner among any LinkedIn matches and extract the owner name
  let ownerName = lead.ownerName || '';
  let bestLinkedin = lead.linkedinUrl || '';
  if (process.env.ANTHROPIC_API_KEY && (rawLinkedIns.length > 0 || !ownerName)) {
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const trimmed = combined.slice(0, 50000);
      const resp = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: `You extract restaurant owner info from website HTML. Output ONLY JSON.

Schema: {"ownerName": "...", "ownerLinkedin": "https://..."}

- ownerName: full name of the owner/founder/chef-owner if explicitly stated. Empty string if not.
- ownerLinkedin: pick the LinkedIn URL that belongs to the owner (not a marketing agency, not a menu PDF link). Pass through one of the candidate URLs if any. Empty string if uncertain.

Never invent. Empty values when unsure.`,
        messages: [
          {
            role: 'user',
            content: `Restaurant: ${lead.name} (${lead.city}, ${lead.state})\nCandidate LinkedIn URLs found on the site: ${rawLinkedIns.join(', ') || '(none)'}\n\nHTML excerpts:\n${trimmed}`,
          },
        ],
      });
      const text = resp.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        if (parsed.ownerName && !ownerName) ownerName = parsed.ownerName;
        if (parsed.ownerLinkedin && !bestLinkedin) bestLinkedin = parsed.ownerLinkedin;
      }
    } catch {}
  }

  // If still no LinkedIn from the website, try a real web search (DDG → Brave fallback)
  if (!bestLinkedin && !lead.linkedinUrl) {
    try {
      const found = await findOwnerLinkedin(lead.name, lead.city, lead.state);
      if (found) bestLinkedin = found;
    } catch {}
  }

  // Pick a primary contact email — prefer non-generic
  const personal = rawEmails.find((e) => !isGeneric(e)) || '';
  const generic = rawEmails.find((e) => isGeneric(e)) || '';
  const primary = personal || generic || lead.contactEmail || '';

  const patch: Partial<Lead> = {
    enrichedAt: Date.now(),
  };
  if (rawEmails.length > 0) patch.emails = rawEmails;
  if (primary && !lead.contactEmail) patch.contactEmail = primary;
  if (primary && lead.contactEmail && isGeneric(lead.contactEmail) && personal) {
    // upgrade the primary to a personal one
    patch.contactEmail = personal;
  }
  if (bestLinkedin && !lead.linkedinUrl) patch.linkedinUrl = bestLinkedin;
  if (ownerName && !lead.ownerName) patch.ownerName = ownerName;

  return patch;
}

export async function POST(req: NextRequest) {
  try {
    const { leads } = await req.json();
    if (!Array.isArray(leads)) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

    // Process in small parallel batches so we don't blow the function timeout
    const BATCH = 3;
    const updates: Array<{ leadId: string; patch: Partial<Lead> }> = [];
    for (let i = 0; i < leads.length; i += BATCH) {
      const slice = leads.slice(i, i + BATCH);
      const results = await Promise.all(
        slice.map(async (l: Lead) => ({ id: l.id, patch: await enrichOne(l) }))
      );
      for (const r of results) {
        if (r.patch && Object.keys(r.patch).length > 1 /* more than just enrichedAt */) {
          updates.push({ leadId: r.id, patch: r.patch });
        }
      }
    }

    return NextResponse.json({ updates });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
