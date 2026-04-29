import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { Lead } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

const SYSTEM = `You are the Bloom Outreach Copilot, embedded in the founder's CRM. You help with two jobs:
1. DRAFT outreach (cold emails, LinkedIn DMs, follow-ups) for restaurants/cafes
2. UPDATE the CRM directly using tools — fix missing contact info, change statuses, set internal notes

THE PRODUCT (Bloom):
- 5 named AI agents (Iris, Echo, Atlas, Sage, Argus) read every Google review for a restaurant, draft replies, surface action items, track menu sentiment, and watch competitors
- Free preview at bloom-psi-jet.vercel.app, $10 unlocks the full live dashboard
- Pitch hook: "Most restaurant owners never read all their reviews. They miss the patterns. They lose customers they don't even know about."

VOICE: plainspoken, founder-to-founder. No marketing speak. No "I hope this email finds you well." Specific over generic — always reference the actual restaurant.

TOOLS YOU HAVE:
- list_leads_missing: find leads missing a specific field (linkedinUrl, contactEmail, ownerName)
- enrich_lead: fetch a lead's restaurant website and extract owner name + LinkedIn + non-generic email
- update_lead: directly patch a lead's fields in the CRM (ownerName, linkedinUrl, contactEmail, internalNotes, status, outreachSent, responded)

WHEN TO USE TOOLS:
- "Make sure every entry has contact info" → list_leads_missing → enrich_lead for each → update_lead with what you found
- "Find LinkedIn for X" → enrich_lead → update_lead
- "Mark X as sent" → update_lead with outreachSent: true
- Drafting outreach: NO tools needed — just write the draft

WHEN UPDATING:
- For contactEmail: skip generic ones (info@, hello@, contact@, support@). Set "" if only generic exists.
- For ownerName: only set if you find a confirmed name.
- For linkedinUrl: only set verified URLs. Don't guess.

AFTER MULTIPLE UPDATES: summarize what you did in 1-2 sentences ("Updated 4 leads with LinkedIn URLs. 3 still missing — couldn't find them publicly.")`;

// ——— Tool definitions ———
const TOOLS = [
  {
    name: 'list_leads_missing',
    description: 'Returns a list of leads that are missing a specific field. Use to find work to do.',
    input_schema: {
      type: 'object' as const,
      properties: {
        field: {
          type: 'string',
          enum: ['linkedinUrl', 'contactEmail', 'ownerName'],
          description: 'Which field to check for missing values',
        },
      },
      required: ['field'],
    },
  },
  {
    name: 'enrich_lead',
    description:
      'Fetches a lead\'s restaurant website and extracts owner name, LinkedIn URL, and personal (non-generic) email. Returns whatever it finds. Returns empty strings for fields that cannot be verified — never invents.',
    input_schema: {
      type: 'object' as const,
      properties: {
        leadId: { type: 'string', description: 'The id of the lead to enrich' },
      },
      required: ['leadId'],
    },
  },
  {
    name: 'update_lead',
    description:
      'Patches a lead\'s fields in the CRM. Only include fields you want to change. Use after enrich_lead returns useful values, or when the user tells you to set something explicitly.',
    input_schema: {
      type: 'object' as const,
      properties: {
        leadId: { type: 'string' },
        patch: {
          type: 'object',
          description: 'Fields to set. Omit fields you are not changing.',
          properties: {
            ownerName: { type: 'string' },
            linkedinUrl: { type: 'string' },
            contactEmail: { type: 'string' },
            internalNotes: { type: 'string' },
            status: {
              type: 'string',
              enum: ['new', 'queued', 'sent', 'replied', 'meeting', 'won', 'lost'],
            },
            outreachSent: { type: 'boolean' },
            responded: { type: 'boolean' },
          },
        },
      },
      required: ['leadId', 'patch'],
    },
  },
];

// ——— Tool implementations ———
async function listLeadsMissing(leads: Lead[], field: keyof Lead) {
  const generics = /^(info|hello|contact|support|hi|admin|team)@/i;
  return leads
    .filter((l) => {
      const v = (l as any)[field] || '';
      if (!v) return true;
      if (field === 'contactEmail' && generics.test(String(v))) return true;
      return false;
    })
    .map((l) => ({
      id: l.id,
      name: l.name,
      website: l.website,
      city: l.city,
      state: l.state,
      type: l.type,
      currentValue: (l as any)[field] || '',
    }));
}

async function enrichLead(lead: Lead): Promise<{
  ownerName?: string;
  linkedinUrl?: string;
  contactEmail?: string;
  notes?: string;
}> {
  if (!lead?.website) return { notes: 'No website on lead.' };
  let html = '';
  try {
    const r = await fetch(lead.website, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    });
    html = await r.text();
  } catch (e: any) {
    return { notes: `Couldn't fetch ${lead.website}: ${e.message}` };
  }

  // Try to also fetch /about and /team if linked
  const links = Array.from(
    html.matchAll(/href=["']([^"']*(about|team|contact|owners?|founders?)[^"']*)["']/gi)
  )
    .map((m) => m[1])
    .filter((href) => href && !href.startsWith('mailto:') && !href.startsWith('tel:'))
    .slice(0, 3);

  for (const link of links) {
    try {
      const u = new URL(link, lead.website).toString();
      const r = await fetch(u, { signal: AbortSignal.timeout(8000) });
      const more = await r.text();
      html += '\n\n---\n\n' + more.slice(0, 30000);
    } catch {}
  }

  const trimmed = html.slice(0, 60000);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const extract = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: `You extract restaurant owner info from website HTML. Return ONLY a JSON object with these keys (omit any you cannot verify):
{
  "ownerName": "Full name of the owner/founder if explicitly stated on the page",
  "linkedinUrl": "Direct https://www.linkedin.com URL only if it appears in the HTML",
  "contactEmail": "A direct email address — SKIP info@, hello@, contact@, support@. Only return if a non-generic email is present",
  "notes": "One sentence on what you found / didn't find"
}
Never invent. Empty strings or omit if not on the page.`,
    messages: [{ role: 'user', content: `Restaurant: ${lead.name} (${lead.city}, ${lead.state})\n\nHTML:\n${trimmed}` }],
  });
  const text = extract.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { notes: 'Extraction returned no JSON.' };
  try {
    const json = JSON.parse(m[0]);
    return json;
  } catch {
    return { notes: 'Extraction JSON failed to parse.' };
  }
}

// ——— Main handler ———
export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured.' }, { status: 500 });
  }
  try {
    const { messages, lead, leads } = await req.json();
    if (!Array.isArray(messages)) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

    const allLeads: Lead[] = Array.isArray(leads) ? leads : lead ? [lead] : [];
    const currentLead: Lead | null = lead || null;

    const leadCtx = currentLead
      ? `\n\nLEAD CURRENTLY SELECTED IN UI:\n- id: ${currentLead.id}\n- ${currentLead.name} · ${currentLead.type} · ${currentLead.city}, ${currentLead.state}\n- website: ${currentLead.website}\n- owner: ${currentLead.ownerName || '(unknown)'}\n- linkedin: ${currentLead.linkedinUrl || '(none)'}\n- email: ${currentLead.contactEmail || '(none)'}\n- status: ${currentLead.status}`
      : '';
    const totalCtx = `\n\nTOTAL LEADS IN CRM: ${allLeads.length}`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const conversation: any[] = messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    }));

    const updates: Array<{ leadId: string; patch: any; reason?: string }> = [];

    for (let iter = 0; iter < 8; iter++) {
      const resp = await client.messages.create({
        model: MODEL,
        max_tokens: 2500,
        system: SYSTEM + leadCtx + totalCtx,
        tools: TOOLS as any,
        messages: conversation,
      });

      if (resp.stop_reason === 'tool_use') {
        const toolBlocks = (resp.content as any[]).filter((b: any) => b.type === 'tool_use');
        const toolResults: any[] = [];
        for (const tb of toolBlocks as Array<{ id: string; name: string; input: any }>) {
          let result: any;
          try {
            if (tb.name === 'list_leads_missing') {
              result = await listLeadsMissing(allLeads, (tb.input as any).field);
            } else if (tb.name === 'enrich_lead') {
              const target = allLeads.find((l) => l.id === (tb.input as any).leadId);
              if (!target) result = { error: 'Lead not found' };
              else result = await enrichLead(target);
            } else if (tb.name === 'update_lead') {
              const { leadId, patch } = tb.input as any;
              if (!allLeads.find((l) => l.id === leadId)) {
                result = { error: 'Lead not found' };
              } else {
                updates.push({ leadId, patch });
                result = { ok: true, leadId, applied: patch };
              }
            } else {
              result = { error: `Unknown tool: ${tb.name}` };
            }
          } catch (e: any) {
            result = { error: e.message };
          }
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tb.id,
            content: JSON.stringify(result),
          });
        }
        conversation.push({ role: 'assistant', content: resp.content });
        conversation.push({ role: 'user', content: toolResults });
        continue;
      }

      // Final reply
      const reply = resp.content
        .map((b: any) => (b.type === 'text' ? b.text : ''))
        .join('')
        .trim();
      return NextResponse.json({ reply, updates });
    }

    return NextResponse.json({ reply: 'Tool loop exceeded — try a smaller request.', updates });
  } catch (err: any) {
    console.error('chat error', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
