'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Lead, LeadStatus } from '@/lib/types';
import { STATUS_COLORS, leadHasContactInfo } from '@/lib/types';
import ChatPanel from './ChatPanel';
import LeadDetailModal from './LeadDetailModal';
import AddLeadModal from './AddLeadModal';

const STORAGE_KEY = 'ms-leads-v1';
const STATUSES: LeadStatus[] = ['new', 'queued', 'sent', 'replied', 'meeting', 'won', 'lost'];

export default function AdminApp({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [selectedId, setSelectedId] = useState<string>(initialLeads[0]?.id || '');
  const [filter, setFilter] = useState<'all' | LeadStatus>('all');
  const [query, setQuery] = useState('');

  const [autoEnriching, setAutoEnriching] = useState(false);
  const [enrichResult, setEnrichResult] = useState<string | null>(null);

  // Hydrate from localStorage — but seed-enriched values win when cache is empty.
  // (Otherwise old localStorage hides newly-enriched LinkedIn/email/owner fields.)
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as Lead[];
      const map = new Map(saved.map((l) => [l.id, l]));
      setLeads((prev) =>
        prev.map((l) => {
          const cached = map.get(l.id);
          if (!cached) return l;
          return {
            ...cached,
            // Seed-fresh static fields always win
            name: l.name,
            website: l.website,
            city: l.city,
            state: l.state,
            type: l.type,
            notes: l.notes,
            // Seed-enriched fields override empties in cache
            ownerName: cached.ownerName || l.ownerName,
            linkedinUrl: cached.linkedinUrl || l.linkedinUrl,
            contactEmail: cached.contactEmail || l.contactEmail,
            emails: cached.emails && cached.emails.length > 0 ? cached.emails : l.emails,
          };
        })
      );
    } catch {}
  }, []);

  // RULE: every lead must have contact info. Auto-enrich any missing on load.
  useEffect(() => {
    const generic = /^(info|hello|contact|support|hi|admin|team|inquiries|reservations|booking)@/i;
    const needsEnrich = leads.filter((l) => {
      if (l.enrichedAt && Date.now() - l.enrichedAt < 7 * 24 * 60 * 60 * 1000) return false; // <7d ago, skip
      const noLinkedin = !l.linkedinUrl;
      const onlyGenericEmail = !l.contactEmail || generic.test(l.contactEmail);
      const noEmailsArray = !l.emails || l.emails.length === 0;
      return noLinkedin || (onlyGenericEmail && noEmailsArray);
    });
    if (needsEnrich.length === 0) return;
    if (autoEnriching) return;
    setAutoEnriching(true);
    (async () => {
      try {
        const r = await fetch('/api/admin/auto-enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leads: needsEnrich }),
        });
        const data = await r.json();
        if (Array.isArray(data.updates)) {
          for (const u of data.updates) update(u.leadId, u.patch);
          setEnrichResult(`Enriched ${data.updates.length} of ${needsEnrich.length} lead${needsEnrich.length === 1 ? '' : 's'}.`);
        } else {
          setEnrichResult('Auto-enrichment returned nothing new.');
        }
      } catch (e: any) {
        setEnrichResult(`Auto-enrichment error: ${e.message}`);
      } finally {
        setAutoEnriching(false);
        setTimeout(() => setEnrichResult(null), 8000);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
  }, [leads]);

  // RULE: leads with NO email and NO LinkedIn are dropped entirely (waiting on enrichment, then excluded).
  const visibleLeads = useMemo(() => leads.filter((l) => leadHasContactInfo(l)), [leads]);
  const hiddenCount = leads.length - visibleLeads.length;

  const filtered = useMemo(() => {
    let out = visibleLeads;
    if (filter !== 'all') out = out.filter((l) => l.status === filter);
    if (query) {
      const q = query.toLowerCase();
      out = out.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.city.toLowerCase().includes(q) ||
          l.type.toLowerCase().includes(q) ||
          l.ownerName.toLowerCase().includes(q)
      );
    }
    return out;
  }, [visibleLeads, filter, query]);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLeadId, setDetailLeadId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const detailLead = leads.find((l) => l.id === detailLeadId) || null;
  function openDetail(id: string) {
    setDetailLeadId(id);
    setDetailOpen(true);
    setSelectedId(id);
  }

  const selected = leads.find((l) => l.id === selectedId) || null;

  function update(id: string, patch: Partial<Lead>) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function addLead(newLead: Lead) {
    setLeads((prev) => [newLead, ...prev]);
    setSelectedId(newLead.id);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header leads={leads} />
      {(autoEnriching || enrichResult) && (
        <div className="px-6 py-2 border-b border-stone-200 bg-paper text-xs flex items-center gap-3">
          {autoEnriching && (
            <>
              <span className="w-3 h-3 rounded-full border-2 border-stone-300 border-t-pink-500 animate-spin" />
              <span className="text-muted">Rule: every lead must have contact info. Auto-enriching missing ones in the background…</span>
            </>
          )}
          {!autoEnriching && enrichResult && (
            <span className="grad-text font-semibold">✓ {enrichResult}</span>
          )}
        </div>
      )}
      <div className="flex-1 grid relative" style={{ gridTemplateColumns: 'minmax(0, 1fr) 460px' }}>
        {/* Left: CRM */}
        <div className="border-r border-stone-200 bg-white">
          <Toolbar
            onAddClick={() => setAddOpen(true)}
            filter={filter}
            setFilter={setFilter}
            query={query}
            setQuery={setQuery}
            counts={countsByStatus(visibleLeads)}
            hiddenCount={hiddenCount}
          />
          <LeadsTable
            leads={filtered}
            selectedId={selectedId}
            onOpen={openDetail}
            onUpdate={update}
            autoEnriching={autoEnriching}
          />
        </div>

        {/* Right: Chat — sticky to viewport, input at TOP, tools enabled */}
        <aside
          className="bg-paper border-l border-stone-200 self-start sticky top-0"
          style={{ height: '100vh' }}
        >
          <ChatPanel
            selected={selected}
            leads={visibleLeads}
            onApplyUpdates={(ups) => {
              for (const u of ups) update(u.leadId, u.patch as any);
            }}
          />
        </aside>
      </div>

      <AddLeadModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={addLead}
        existingIds={new Set(leads.map((l) => l.id))}
      />
      <LeadDetailModal
        lead={detailLead}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onUpdate={update}
      />
    </div>
  );
}

function Header({ leads }: { leads: Lead[] }) {
  const total = leads.length;
  const sent = leads.filter((l) => l.outreachSent).length;
  const replied = leads.filter((l) => l.responded).length;
  const won = leads.filter((l) => l.status === 'won').length;
  return (
    <header className="px-6 py-4 border-b border-stone-200 bg-white flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-3">
        <a href="/" className="serif text-2xl tracking-tight font-semibold">
          <span className="grad-text">Bloom</span>
        </a>
        <span className="kbd">outreach admin</span>
      </div>
      <div className="text-sm flex items-center gap-5">
        <Stat label="leads" value={total} />
        <Stat label="contacted" value={sent} />
        <Stat label="replied" value={replied} />
        <Stat label="won" value={won} accent />
        <a href="/" className="text-xs text-muted hover:underline ml-2">view site →</a>
      </div>
    </header>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="text-center">
      <div className={`serif text-xl leading-none ${accent ? 'grad-text font-bold' : ''}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-widest text-muted mt-0.5">{label}</div>
    </div>
  );
}

function Toolbar({
  filter,
  setFilter,
  query,
  setQuery,
  counts,
  hiddenCount,
  onAddClick,
}: {
  filter: 'all' | LeadStatus;
  setFilter: (f: 'all' | LeadStatus) => void;
  query: string;
  setQuery: (q: string) => void;
  counts: Record<string, number>;
  hiddenCount?: number;
  onAddClick?: () => void;
}) {
  const tabs: Array<'all' | LeadStatus> = ['all', ...STATUSES];
  return (
    <div className="px-6 py-3 border-b border-stone-200 flex items-center gap-3 flex-wrap">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search name, city, type, owner…"
        className="px-3 py-2 rounded-lg bg-paper border border-stone-200 outline-none text-sm w-64"
      />
      <div className="flex gap-1 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`text-xs px-2.5 py-1 rounded-full border ${
              filter === t ? 'bg-ink text-white border-ink' : 'bg-white border-stone-200 text-muted'
            }`}
          >
            {t} {t !== 'all' && counts[t] ? `· ${counts[t]}` : ''}
          </button>
        ))}
      </div>
      {hiddenCount && hiddenCount > 0 ? (
        <div className="ml-auto text-[10px] uppercase tracking-widest text-muted">
          {hiddenCount} hidden · no contact info
        </div>
      ) : null}
      {onAddClick && (
        <button
          onClick={onAddClick}
          className={`${hiddenCount && hiddenCount > 0 ? '' : 'ml-auto'} text-xs px-4 py-1.5 rounded-full bg-ink text-white hover:bg-stone-800 font-medium`}
        >
          + Add lead
        </button>
      )}
    </div>
  );
}

function LeadsTable({
  leads,
  selectedId,
  onOpen,
  onUpdate,
  autoEnriching,
}: {
  leads: Lead[];
  selectedId: string;
  onOpen: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Lead>) => void;
  autoEnriching?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-stone-50 text-xs uppercase tracking-wider text-muted">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Business</th>
            <th className="text-left px-4 py-3 font-medium">Type</th>
            <th className="text-left px-4 py-3 font-medium">Location</th>
            <th className="text-left px-4 py-3 font-medium">Contact</th>
            <th className="text-center px-3 py-3 font-medium">Sent</th>
            <th className="text-center px-3 py-3 font-medium">Replied</th>
            <th className="text-left px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr
              key={l.id}
              onClick={() => onOpen(l.id)}
              className={`border-t border-stone-100 cursor-pointer hover:bg-stone-50 ${
                selectedId === l.id ? 'bg-amber-50/50' : ''
              }`}
            >
              <td className="px-4 py-3">
                <div className="font-medium">{l.name}</div>
                <a
                  href={l.website}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-muted hover:underline"
                >
                  {l.website.replace(/^https?:\/\//, '')}
                </a>
              </td>
              <td className="px-4 py-3 text-muted">{l.type}</td>
              <td className="px-4 py-3 text-muted">{l.city}, {l.state}</td>
              <td className="px-4 py-3 text-xs">
                {l.contactEmail && (
                  <a
                    href={`mailto:${l.contactEmail}`}
                    onClick={(e) => e.stopPropagation()}
                    className="block hover:underline truncate"
                    title={l.contactEmail}
                  >
                    ✉ {l.contactEmail}
                  </a>
                )}
                {l.emails && l.emails.length > 1 && (
                  <span className="block text-[10px] text-muted">+{l.emails.length - 1} more</span>
                )}
                {l.linkedinUrl && (
                  <a
                    href={l.linkedinUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="block hover:underline text-blue-700 truncate"
                  >
                    in/{l.ownerName.split(' ')[0] || 'profile'}
                  </a>
                )}
                {!l.contactEmail && !l.linkedinUrl && (
                  autoEnriching ? (
                    <span className="text-amber-600 text-[10px] italic">checking the website…</span>
                  ) : l.enrichedAt ? (
                    <span className="text-stone-400 text-[10px] italic">no public contact found</span>
                  ) : (
                    <span className="text-rose-500 text-[10px] italic">missing</span>
                  )
                )}
              </td>
              <td className="px-3 py-3 text-center">
                <Checkbox
                  checked={l.outreachSent}
                  onChange={(v) =>
                    onUpdate(l.id, {
                      outreachSent: v,
                      status: v && l.status === 'new' ? 'sent' : l.status,
                      lastTouch: v ? new Date().toISOString() : l.lastTouch,
                    })
                  }
                />
              </td>
              <td className="px-3 py-3 text-center">
                <Checkbox
                  checked={l.responded}
                  onChange={(v) =>
                    onUpdate(l.id, {
                      responded: v,
                      status: v && (l.status === 'sent' || l.status === 'queued') ? 'replied' : l.status,
                    })
                  }
                />
              </td>
              <td className="px-4 py-3">
                <select
                  value={l.status}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => onUpdate(l.id, { status: e.target.value as LeadStatus })}
                  className={`text-xs px-2 py-1 rounded-full border ${STATUS_COLORS[l.status]} cursor-pointer`}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
          {leads.length === 0 && (
            <tr><td colSpan={7} className="text-center py-12 text-muted">No leads match.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Checkbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      className={`w-5 h-5 rounded border flex items-center justify-center ${
        checked ? 'bg-emerald-500 border-emerald-600 text-white' : 'bg-white border-stone-300'
      }`}
      aria-pressed={checked}
    >
      {checked && (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 6.5L4.5 9L10 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

function DetailPanel({ lead, onUpdate }: { lead: Lead; onUpdate: (id: string, patch: Partial<Lead>) => void }) {
  return (
    <div className="border-t border-stone-200 bg-stone-50/50">
      <div className="px-6 py-5">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <h3 className="serif text-2xl">{lead.name}</h3>
            <p className="text-sm text-muted">
              {lead.type} · {lead.city}, {lead.state}
              {lead.ownerName && ` · owner: ${lead.ownerName}`}
            </p>
          </div>
          <a href={lead.website} target="_blank" rel="noreferrer" className="text-xs underline text-muted">
            visit site →
          </a>
        </div>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted mb-1">Why their site is bad</div>
            <p>{lead.notes}</p>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted mb-1">Internal notes</div>
            <textarea
              value={lead.internalNotes || ''}
              onChange={(e) => onUpdate(lead.id, { internalNotes: e.target.value })}
              placeholder="Add notes — what you said, what they replied, next step…"
              className="w-full p-2 rounded-lg bg-white border border-stone-200 text-sm min-h-[80px]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function countsByStatus(leads: Lead[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of leads) out[l.status] = (out[l.status] || 0) + 1;
  return out;
}
