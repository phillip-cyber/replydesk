'use client';
import { useEffect, useRef, useState } from 'react';
import type { Lead } from '@/lib/types';

type Msg = { role: 'user' | 'assistant'; content: string };

const QUICK_ACTIONS = [
  {
    label: 'Draft cold email',
    prompt:
      'Draft a 90-word cold email to the owner pitching Bloom. Specific to this restaurant — reference the cuisine or city. Lead with what they\'re missing in their reviews. End with: "Want me to run your URL through it? 30 seconds, free preview." Subject line + body separated.',
  },
  {
    label: 'Draft LinkedIn connection note',
    prompt:
      'Draft a LinkedIn connection note under 300 characters. Rules: no mention of Bloom, no agents, no product pitch whatsoever. One specific data point only — their review count, a friction pattern in their lower-rated reviews, or a specific number. No exclamation points. Goal is only to earn the accept — the follow-up does the pitch. Structure: "Hi [first name], [one specific finding from their reviews]. Wanted to share what I found."',
  },
  {
    label: 'Followup #1',
    prompt:
      'Draft a 3-day follow-up email. Reference my last note. Add ONE new value beat. One-line CTA.',
  },
  {
    label: 'Find missing contacts',
    prompt:
      "Audit the CRM. Find every lead missing LinkedIn URL or with a generic email (info@, hello@, contact@, support@). Use enrich_lead to find the owner's LinkedIn + a personal email for each one. Apply update_lead for whatever you find. Skip leads where you can't verify info — don't invent. Summarize what you updated and what's still missing.",
  },
  {
    label: 'Why they\'re a fit',
    prompt:
      'Give me 3 specific reasons this restaurant is a good fit for Bloom. Look at type, location, internal notes. Be concrete.',
  },
];

const SKILL_BLURB = `## What this chat does

This is Claude Sonnet/Haiku 4.5 with tool-use enabled. It can:
- Draft outreach (emails, LinkedIn DMs, follow-ups)
- Update CRM rows directly (LinkedIn, email, status, notes)
- Enrich leads — fetch their website + about/team pages, extract owner info

Tools available: list_leads_missing, enrich_lead, update_lead.

Updates from the chat get applied to the CRM in real time.`;

export default function ChatPanel({
  selected,
  leads,
  onApplyUpdates,
}: {
  selected: Lead | null;
  leads?: Lead[];
  onApplyUpdates?: (updates: Array<{ leadId: string; patch: Partial<Lead> }>) => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSkill, setShowSkill] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
  }, [selected?.id]);

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [messages]);

  async function send(prompt?: string) {
    const text = (prompt ?? input).trim();
    if (!text) return;
    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, lead: selected, leads }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chat failed');

      // Apply CRM updates if Claude called update_lead
      if (Array.isArray(data.updates) && data.updates.length > 0 && onApplyUpdates) {
        onApplyUpdates(data.updates);
      }

      const summary =
        Array.isArray(data.updates) && data.updates.length > 0
          ? `\n\n— Applied ${data.updates.length} update${data.updates.length === 1 ? '' : 's'} to the CRM.`
          : '';

      setMessages((m) => [...m, { role: 'assistant', content: (data.reply || '') + summary }]);
    } catch (err: any) {
      setMessages((m) => [...m, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  const reversed = [...messages].reverse();

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-stone-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="serif text-base leading-tight">
              <span className="grad-text font-semibold">Outreach</span> Copilot
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted">tools enabled · drafts + CRM updates</div>
          </div>
          <button onClick={() => setShowSkill((v) => !v)} className="text-[10px] uppercase tracking-widest text-muted hover:underline">
            {showSkill ? 'hide' : 'how this works'}
          </button>
        </div>
        {showSkill && (
          <div className="mt-2 text-xs text-stone-700 bg-stone-50 border border-stone-200 rounded-lg p-3 whitespace-pre-wrap">
            {SKILL_BLURB}
          </div>
        )}
        {selected ? (
          <div className="mt-2 text-xs text-muted truncate">
            <b className="text-ink">{selected.name}</b> · {selected.type} · {selected.city}, {selected.state}
          </div>
        ) : (
          <div className="mt-2 text-xs text-muted">No lead selected — bulk actions still work.</div>
        )}
      </div>

      {/* Input — TOP */}
      <div className="px-5 py-3 border-b border-stone-200 bg-white">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tell Claude what to do… (drafts, CRM updates, enrichment)"
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send();
            }}
            className="flex-1 resize-none px-3 py-2 rounded-xl bg-paper border border-stone-200 outline-none text-sm min-h-[60px]"
            rows={2}
            autoFocus
          />
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            className="btn-grad px-4 py-2 text-sm disabled:opacity-50 self-stretch"
          >
            Send
          </button>
        </div>
        <div className="text-[10px] text-muted mt-1">⌘+Enter to send</div>
      </div>

      {/* Quick actions */}
      <div className="px-5 py-2.5 border-b border-stone-200 bg-stone-50/50 flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.label}
            onClick={() => send(a.prompt)}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-full bg-white border border-stone-200 hover:bg-stone-50 disabled:opacity-50"
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Messages — newest first */}
      <div ref={messagesRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {loading && <div className="text-sm text-muted italic">Working… (tool calls may take 30-60s)</div>}
        {reversed.length === 0 && !loading && (
          <div className="text-sm text-muted">
            Try a quick action above. Or type something like:<br />
            <span className="text-stone-700 italic">&ldquo;Find LinkedIn URLs for every lead missing one&rdquo;</span>
          </div>
        )}
        {reversed.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
            <div
              className={`inline-block max-w-[92%] text-sm rounded-2xl px-4 py-3 whitespace-pre-wrap text-left ${
                m.role === 'user' ? 'bg-ink text-white' : 'bg-white border border-stone-200'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
