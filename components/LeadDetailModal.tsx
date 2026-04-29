'use client';
import { useEffect, useState } from 'react';
import type { Lead } from '@/lib/types';
import { STATUS_COLORS } from '@/lib/types';

const STATUSES = ['new', 'queued', 'sent', 'replied', 'meeting', 'won', 'lost'] as const;
const PLATFORMS = ['LinkedIn DM', 'Email', 'X / Twitter DM', 'Reddit DM', ''] as const;

export default function LeadDetailModal({
  lead,
  open,
  onClose,
  onUpdate,
}: {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Lead>) => void;
}) {
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [generateErr, setGenerateErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open || !lead) return null;

  // Derive default contact platform if not set
  const platform =
    lead.contactPlatform ||
    (lead.linkedinUrl ? 'LinkedIn DM' : lead.contactEmail ? 'Email' : '');
  const bloomPreviewUrl = `/?prefill=${encodeURIComponent(lead.website)}`;

  async function generateEmail() {
    if (!lead) return;
    setGeneratingEmail(true);
    setGenerateErr(null);
    try {
      const messages = [
        {
          role: 'user' as const,
          content:
            'Draft a cold email for this restaurant pitching Bloom. Output ONLY two lines:\nSubject: <subject>\nBody: <body, max 90 words, plainspoken, specific to this restaurant>',
        },
      ];
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, lead, leads: [lead] }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed');
      const reply: string = data.reply || '';
      const subjMatch = reply.match(/Subject:\s*(.*?)(?:\n|$)/i);
      const bodyMatch = reply.match(/Body:\s*([\s\S]*)/i);
      const subject = (subjMatch?.[1] || '').trim();
      const body = (bodyMatch?.[1] || '').trim();
      if (!subject && !body) throw new Error('Could not parse email from response.');
      onUpdate(lead.id, {
        proposedEmailSubject: subject || lead.proposedEmailSubject,
        proposedEmailBody: body || lead.proposedEmailBody,
      });
    } catch (e: any) {
      setGenerateErr(e.message);
    } finally {
      setGeneratingEmail(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-ink/30 backdrop-blur-sm" onClick={onClose} />
      <aside className="w-full max-w-[560px] bg-paper border-l border-stone-200 overflow-y-auto shadow-2xl">
        <header className="px-7 pt-6 pb-5 border-b border-stone-200 bg-white sticky top-0 z-10">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="serif text-2xl tracking-tight truncate">{lead.name}</h2>
              <p className="text-sm text-muted mt-0.5">
                {lead.type} · {lead.city}, {lead.state}
              </p>
              <a
                href={lead.website}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-700 hover:underline break-all"
              >
                {lead.website.replace(/^https?:\/\//, '')}
              </a>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-full flex items-center justify-center text-stone-400 hover:bg-stone-100 hover:text-ink transition shrink-0"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </header>

        <div className="px-7 py-6 space-y-7">
          {/* Properties grid */}
          <PropList>
            <PropRow label="Status">
              <select
                value={lead.status}
                onChange={(e) => onUpdate(lead.id, { status: e.target.value as any })}
                className={`text-xs px-3 py-1.5 rounded-full border ${STATUS_COLORS[lead.status]} cursor-pointer`}
              >
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </PropRow>
            <PropRow label="DM Sent">
              <Checkbox
                checked={lead.outreachSent}
                onChange={(v) => onUpdate(lead.id, { outreachSent: v, status: v && lead.status === 'new' ? 'sent' : lead.status, lastTouch: v ? new Date().toISOString() : lead.lastTouch })}
              />
            </PropRow>
            <PropRow label="Responded">
              <Checkbox
                checked={lead.responded}
                onChange={(v) => onUpdate(lead.id, { responded: v, status: v && (lead.status === 'sent' || lead.status === 'queued') ? 'replied' : lead.status })}
              />
            </PropRow>
            <PropRow label="Interviewed">
              <Checkbox checked={!!lead.interviewed} onChange={(v) => onUpdate(lead.id, { interviewed: v })} />
            </PropRow>
            <PropRow label="Customer">
              <Checkbox checked={!!lead.betaUser} onChange={(v) => onUpdate(lead.id, { betaUser: v })} />
            </PropRow>
            <PropRow label="Contact Platform">
              <select
                value={lead.contactPlatform ?? platform}
                onChange={(e) => onUpdate(lead.id, { contactPlatform: e.target.value as any })}
                className="text-xs px-2 py-1 rounded-md border border-stone-200 bg-white"
              >
                {PLATFORMS.map((p) => <option key={p} value={p}>{p || '—'}</option>)}
              </select>
            </PropRow>
            <PropRow label="Owner">
              <input
                value={lead.ownerName || ''}
                onChange={(e) => onUpdate(lead.id, { ownerName: e.target.value })}
                placeholder="—"
                className="text-sm bg-transparent outline-none w-full max-w-[260px]"
              />
            </PropRow>
            <PropRow label="LinkedIn">
              {lead.linkedinUrl ? (
                <a href={lead.linkedinUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-700 hover:underline break-all">
                  {lead.linkedinUrl.replace(/^https?:\/\/(www\.)?/, '')}
                </a>
              ) : (
                <span className="text-xs text-muted italic">no public profile found</span>
              )}
            </PropRow>
            <PropRow label="Primary email">
              {lead.contactEmail ? (
                <a href={`mailto:${lead.contactEmail}`} className="text-sm hover:underline break-all">
                  {lead.contactEmail}
                </a>
              ) : (
                <span className="text-xs text-muted italic">none</span>
              )}
            </PropRow>
            {lead.emails && lead.emails.length > 1 && (
              <PropRow label="All emails">
                <div className="flex flex-col gap-1">
                  {lead.emails.map((e) => (
                    <a key={e} href={`mailto:${e}`} className="text-xs hover:underline break-all">
                      {e}
                    </a>
                  ))}
                </div>
              </PropRow>
            )}
            <PropRow label="Bloom preview">
              <a
                href={bloomPreviewUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs grad-text font-semibold hover:underline inline-flex items-center gap-1"
              >
                Run their URL through Bloom →
              </a>
            </PropRow>
          </PropList>

          {/* Background */}
          <Section title="Background">
            <p className="text-sm leading-relaxed text-stone-700">
              {lead.notes || <span className="italic text-muted">No background notes yet.</span>}
            </p>
          </Section>

          <Section title="Why Target">
            <textarea
              value={lead.whyTarget || ''}
              onChange={(e) => onUpdate(lead.id, { whyTarget: e.target.value })}
              placeholder="Why this restaurant fits Bloom — review volume, signals from their site, location density…"
              className="w-full p-3 rounded-lg border border-stone-200 bg-white text-sm leading-relaxed min-h-[90px] outline-none focus:border-stone-400"
            />
          </Section>

          <Section title="Key Takeaways">
            <textarea
              value={lead.keyTakeaways || ''}
              onChange={(e) => onUpdate(lead.id, { keyTakeaways: e.target.value })}
              placeholder="Anything you've learned from interviews, replies, calls…"
              className="w-full p-3 rounded-lg border border-stone-200 bg-white text-sm leading-relaxed min-h-[90px] outline-none focus:border-stone-400"
            />
          </Section>

          {/* Proposed email */}
          <Section
            title="Proposed Email"
            action={
              <button
                onClick={generateEmail}
                disabled={generatingEmail}
                className="text-[10px] uppercase tracking-widest grad-text font-bold hover:underline disabled:opacity-50"
              >
                {generatingEmail ? 'drafting…' : 'generate with claude →'}
              </button>
            }
          >
            <input
              value={lead.proposedEmailSubject || ''}
              onChange={(e) => onUpdate(lead.id, { proposedEmailSubject: e.target.value })}
              placeholder="Subject line"
              className="w-full px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm outline-none focus:border-stone-400 mb-2"
            />
            <textarea
              value={lead.proposedEmailBody || ''}
              onChange={(e) => onUpdate(lead.id, { proposedEmailBody: e.target.value })}
              placeholder="Body of the cold email…"
              className="w-full p-3 rounded-lg border border-stone-200 bg-white text-sm leading-relaxed min-h-[140px] outline-none focus:border-stone-400"
            />
            {generateErr && <p className="text-xs text-rose-600 mt-2">{generateErr}</p>}
            {(lead.proposedEmailSubject || lead.proposedEmailBody) && (
              <div className="flex gap-2 mt-2 flex-wrap items-center">
                <button
                  onClick={() => {
                    const text = `Subject: ${lead.proposedEmailSubject || ''}\n\n${lead.proposedEmailBody || ''}`;
                    navigator.clipboard.writeText(text);
                  }}
                  className="text-xs px-3 py-1.5 rounded-full bg-white border border-stone-200 hover:bg-stone-50"
                >
                  Copy email
                </button>
                {lead.contactEmail && (
                  <a
                    href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(lead.contactEmail)}&su=${encodeURIComponent(
                      lead.proposedEmailSubject || ''
                    )}&body=${encodeURIComponent(lead.proposedEmailBody || '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-3 py-1.5 rounded-full btn-grad"
                  >
                    Open Gmail compose →
                  </a>
                )}
                {lead.contactEmail && (
                  <button
                    onClick={() =>
                      onUpdate(lead.id, {
                        outreachSent: true,
                        status: lead.status === 'replied' || lead.status === 'won' || lead.status === 'meeting' ? lead.status : 'sent',
                        lastEmailAt: Date.now(),
                        lastEmailTo: lead.contactEmail,
                        lastPlatform: 'Email',
                        lastTouch: new Date().toISOString(),
                      })
                    }
                    className="text-xs px-3 py-1.5 rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    Mark email sent
                  </button>
                )}
                {lead.outreachSent && lead.lastEmailAt && (
                  <span className="text-[11px] text-emerald-700">
                    sent {new Date(lead.lastEmailAt).toLocaleDateString()}
                    {lead.lastEmailTo ? ` → ${lead.lastEmailTo}` : ''}
                  </span>
                )}
              </div>
            )}
          </Section>

          {(lead.linkedinUrl || lead.proposedDmMessage) && (
            <Section title="LinkedIn outreach">
              {lead.linkedinUrl && (
                <div className="flex gap-2 mb-2 flex-wrap">
                  <a
                    href={lead.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-3 py-1.5 rounded-full bg-[#0a66c2] text-white hover:bg-[#0a4f99]"
                  >
                    Open LinkedIn profile →
                  </a>
                  <span className="text-[11px] text-muted self-center">
                    Click Connect → Add a note → paste below
                  </span>
                </div>
              )}
              {lead.proposedDmMessage && (
                <textarea
                  value={lead.proposedDmMessage}
                  readOnly
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                  className="w-full p-3 rounded-lg border border-stone-200 bg-stone-50 text-xs leading-relaxed min-h-[100px] outline-none font-mono"
                />
              )}
              <div className="flex gap-2 mt-2 flex-wrap">
                {lead.proposedDmMessage && (
                  <button
                    onClick={() => navigator.clipboard.writeText(lead.proposedDmMessage || '')}
                    className="text-xs px-3 py-1.5 rounded-full bg-white border border-stone-200 hover:bg-stone-50"
                  >
                    Copy DM
                  </button>
                )}
                <button
                  onClick={() =>
                    onUpdate(lead.id, {
                      lastPlatform: 'LinkedIn',
                      lastTouch: new Date().toISOString(),
                      internalNotes: ((lead.internalNotes || '') + `\nLinkedIn invite sent ${new Date().toLocaleDateString()}`).trim(),
                    })
                  }
                  className="text-xs px-3 py-1.5 rounded-full bg-[#0a66c2] text-white hover:bg-[#0a4f99]"
                >
                  Mark LinkedIn sent
                </button>
              </div>
            </Section>
          )}

          <Section title="Internal Notes">
            <textarea
              value={lead.internalNotes || ''}
              onChange={(e) => onUpdate(lead.id, { internalNotes: e.target.value })}
              placeholder="What you said, what they replied, next step…"
              className="w-full p-3 rounded-lg border border-stone-200 bg-white text-sm leading-relaxed min-h-[100px] outline-none focus:border-stone-400"
            />
          </Section>
        </div>
      </aside>
    </div>
  );
}

function PropList({ children }: { children: React.ReactNode }) {
  return <div className="card divide-y divide-stone-100">{children}</div>;
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="text-xs uppercase tracking-widest text-muted w-32 shrink-0 pt-1.5">{label}</div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] uppercase tracking-widest text-muted">{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Checkbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-5 h-5 rounded border flex items-center justify-center transition ${
        checked ? 'bg-emerald-500 border-emerald-600 text-white' : 'bg-white border-stone-300'
      }`}
    >
      {checked && (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 6.5L4.5 9L10 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
