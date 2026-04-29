'use client';
import { useEffect, useMemo, useState } from 'react';
import { signOut } from 'next-auth/react';
import { AGENTS, AGENT_LIST, type AgentKey } from '@/lib/agents';

type Report = {
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
  atlasActionItems: string[];
  sageMenuMentions: { dish: string; sentiment: string; mentions: number }[];
  argusCompetitors: { name: string; rating?: number; totalReviews?: number; takeaway: string }[];
  reviews: Array<{
    id: string;
    author: string;
    rating: number;
    text: string;
    time: number;
    agent: AgentKey;
    sentiment: 'positive' | 'mixed' | 'negative';
    themes: string[];
    draftedReply: string;
    status: 'new' | 'reply-drafted' | 'replied' | 'archived';
    reviewLink?: string | null;
    authorUrl?: string | null;
  }>;
  generatedAt?: number;
};

type Tab = 'overview' | 'reviews' | 'actions' | 'menu' | 'competitors';

export default function DashboardClient({
  initialReports,
  initialEmail,
  allPlaceIds,
}: {
  initialReports: Report[] | null;
  initialEmail: string | null;
  allPlaceIds?: string[];
}) {
  const [reports, setReports] = useState<Report[]>(initialReports || []);
  const [missing, setMissing] = useState(false);
  const [activePlaceId, setActivePlaceId] = useState<string | null>(initialReports?.[0]?.placeId || null);
  const [tab, setTab] = useState<Tab>('overview');
  const [reviewState, setReviewState] = useState<Record<string, { status: string; reply: string }>>({});
  const [toast, setToast] = useState<string | null>(null);

  // Fallback to localStorage for users who paid before KV was wired (or before signing in)
  useEffect(() => {
    if (initialReports && initialReports.length > 0) return;
    if (typeof window === 'undefined') return;
    const keys = Object.keys(localStorage)
      .filter((k) => k.startsWith('bloom-report-') || k.startsWith('bloom-rebuild-'))
      .sort()
      .reverse();
    if (keys.length === 0) {
      setMissing(true);
      return;
    }
    const raw = localStorage.getItem(keys[0]);
    if (!raw) { setMissing(true); return; }
    try {
      const parsed = JSON.parse(raw);
      const r: Report | null = parsed.report || null;
      if (!r) { setMissing(true); return; }
      setReports([r]);
      setActivePlaceId(r.placeId);
    } catch {
      setMissing(true);
    }
  }, [initialReports]);

  const report = reports.find((r) => r.placeId === activePlaceId) || reports[0] || null;

  // Hydrate review state when active report changes
  useEffect(() => {
    if (!report) return;
    const init: typeof reviewState = {};
    report.reviews.forEach((rv) => {
      init[rv.id] = { status: rv.status, reply: rv.draftedReply };
    });
    setReviewState(init);
  }, [report?.placeId]);

  if (!report && missing) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8 text-center">
        <div>
          <h1 className="serif text-3xl mb-3">No report found.</h1>
          <p className="text-muted mb-6">
            {initialEmail
              ? 'No paid restaurants on this account yet. Run a free preview and unlock to see your dashboard.'
              : 'Sign in to see your dashboards across devices.'}
          </p>
          <a href="/" className="btn-grad inline-flex">Start a new report →</a>
        </div>
      </main>
    );
  }

  if (!report) {
    return <main className="min-h-screen flex items-center justify-center"><div className="text-muted">Loading…</div></main>;
  }

  function flashToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  return (
    <main className="min-h-screen">
      <DashboardHeader report={report} email={initialEmail} reports={reports} setActivePlaceId={setActivePlaceId} activePlaceId={activePlaceId} />
      <DashboardNav tab={tab} setTab={setTab} report={report} />
      <div className="max-w-6xl mx-auto px-6 py-8">
        {tab === 'overview' && <Overview report={report} />}
        {tab === 'reviews' && (
          <ReviewsCRM
            report={report}
            reviewState={reviewState}
            setReviewState={setReviewState}
            flashToast={flashToast}
          />
        )}
        {tab === 'actions' && <ActionItems items={report.atlasActionItems} patterns={report.emergingPatterns} />}
        {tab === 'menu' && <MenuIntel mentions={report.sageMenuMentions} />}
        {tab === 'competitors' && <Competitors items={report.argusCompetitors} />}
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 card px-4 py-3 shadow-2xl text-sm bg-white border-stone-200">
          {toast}
        </div>
      )}
    </main>
  );
}

function DashboardHeader({
  report, email, reports, setActivePlaceId, activePlaceId,
}: {
  report: Report;
  email: string | null;
  reports: Report[];
  setActivePlaceId: (id: string) => void;
  activePlaceId: string | null;
}) {
  const showSwitcher = reports.length > 1;
  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-baseline gap-3">
          <a href="/" className="text-2xl serif font-semibold tracking-tight">
            <span className="grad-text">Bloom</span>
          </a>
          <span className="text-muted text-sm">·</span>
          {showSwitcher ? (
            <select
              value={activePlaceId || ''}
              onChange={(e) => setActivePlaceId(e.target.value)}
              className="serif text-lg leading-tight bg-transparent outline-none cursor-pointer hover:underline"
            >
              {reports.map((r) => (
                <option key={r.placeId} value={r.placeId}>{r.placeName}</option>
              ))}
            </select>
          ) : (
            <div>
              <div className="serif text-lg leading-tight">{report.placeName}</div>
              {report.address && <div className="text-xs text-muted">{report.address}</div>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="serif text-2xl leading-none">{report.rating?.toFixed(1) ?? '—'}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted">{report.totalReviews ?? 0} reviews</div>
          </div>
          {email && (
            <button onClick={() => signOut({ callbackUrl: '/' })} className="text-xs text-muted hover:underline">
              sign out
            </button>
          )}
        </div>
      </div>
      {report.generatedAt && (
        <div className="max-w-6xl mx-auto px-6 pb-2 text-[10px] uppercase tracking-widest text-muted">
          last refreshed {fmtAgo(report.generatedAt)} · daily auto-refresh
        </div>
      )}
    </header>
  );
}

function fmtAgo(ts: number): string {
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function DashboardNav({ tab, setTab, report }: { tab: Tab; setTab: (t: Tab) => void; report: Report }) {
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'reviews', label: 'Reviews', count: report.reviews.length },
    { key: 'actions', label: 'Action Items', count: report.atlasActionItems.length },
    { key: 'menu', label: 'Menu Intel', count: report.sageMenuMentions.length },
    { key: 'competitors', label: 'Competitors', count: report.argusCompetitors.length },
  ];
  return (
    <div className="border-b border-stone-200 bg-stone-50/50">
      <div className="max-w-6xl mx-auto px-6 flex gap-1 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-3 text-sm border-b-2 transition whitespace-nowrap ${
              tab === t.key ? 'border-pink-500 text-ink font-semibold' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {t.label}
            {typeof t.count === 'number' && <span className="ml-1.5 text-xs text-muted">{t.count}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function Overview({ report }: { report: Report }) {
  const sentColor = report.overallSentiment === 'positive' ? 'text-emerald-700' :
                    report.overallSentiment === 'negative' ? 'text-rose-700' : 'text-amber-700';
  const reviewsByAgent = AGENT_LIST.map((a) => ({
    agent: a,
    count: report.reviews.filter((r) => r.agent === a.key).length,
  }));

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Sentiment" value={<span className={`${sentColor} capitalize font-semibold`}>{report.overallSentiment}</span>} />
        <Stat label="Total reviews" value={report.totalReviews?.toLocaleString() || '—'} />
        <Stat label="Average rating" value={report.rating?.toFixed(1) || '—'} />
        <Stat label="Action items" value={String(report.atlasActionItems.length)} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-6">
          <div className="text-[10px] uppercase tracking-widest text-muted mb-3 flex items-center gap-2">
            <AgentDot k="sage" /> What customers love
          </div>
          <ul className="space-y-2">
            {report.positiveThemes.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0 bg-emerald-500" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-6">
          <div className="text-[10px] uppercase tracking-widest text-muted mb-3 flex items-center gap-2">
            <AgentDot k="atlas" /> What needs work
          </div>
          {report.negativeThemes.length > 0 ? (
            <ul className="space-y-2">
              {report.negativeThemes.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0 bg-rose-500" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No common complaints.</p>
          )}
        </div>
      </div>

      {report.emergingPatterns.length > 0 && (
        <div className="card p-6">
          <div className="text-[10px] uppercase tracking-widest text-muted mb-3 flex items-center gap-2">
            <AgentDot k="atlas" /> Atlas spotted these patterns
          </div>
          <ul className="space-y-3">
            {report.emergingPatterns.map((p, i) => (
              <li key={i} className="text-sm leading-relaxed">{p}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="card p-6">
        <div className="text-[10px] uppercase tracking-widest text-muted mb-4">Reviews assigned to each agent</div>
        <div className="grid grid-cols-5 gap-3">
          {reviewsByAgent.map(({ agent, count }) => (
            <div key={agent.key} className="text-center">
              <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center text-white serif font-bold text-lg"
                style={{ backgroundImage: 'linear-gradient(120deg,#EC4899,#A855F7,#6366F1)' }}>
                {agent.letter}
              </div>
              <div className="serif text-2xl mt-2">{count}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted">{agent.name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReviewsCRM({
  report, reviewState, setReviewState, flashToast,
}: {
  report: Report;
  reviewState: Record<string, { status: string; reply: string }>;
  setReviewState: React.Dispatch<React.SetStateAction<Record<string, { status: string; reply: string }>>>;
  flashToast: (msg: string) => void;
}) {
  const [agentFilter, setAgentFilter] = useState<AgentKey | 'all'>('all');
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (agentFilter === 'all') return report.reviews;
    return report.reviews.filter((r) => r.agent === agentFilter);
  }, [report.reviews, agentFilter]);

  const sel = filtered.find((r) => r.id === selected) || filtered[0] || null;

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <div className="flex gap-2 mb-3 flex-wrap">
          <FilterChip active={agentFilter === 'all'} onClick={() => setAgentFilter('all')}>
            All · {report.reviews.length}
          </FilterChip>
          {AGENT_LIST.map((a) => {
            const c = report.reviews.filter((r) => r.agent === a.key).length;
            return (
              <FilterChip key={a.key} active={agentFilter === a.key} onClick={() => setAgentFilter(a.key)}>
                {a.name} · {c}
              </FilterChip>
            );
          })}
        </div>
        <div className="space-y-2 max-h-[70vh] overflow-y-auto">
          {filtered.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelected(r.id)}
              className={`w-full text-left card p-4 hover:bg-stone-50 transition ${
                sel?.id === r.id ? 'ring-2 ring-pink-200' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs serif font-bold"
                    style={{ backgroundImage: 'linear-gradient(120deg,#EC4899,#A855F7,#6366F1)' }}>
                    {AGENTS[r.agent].letter}
                  </span>
                  <span className="text-sm font-medium">{r.author}</span>
                </div>
                <Stars n={r.rating} />
              </div>
              <p className="text-xs text-muted line-clamp-2">{r.text}</p>
              <div className="flex items-center gap-2 mt-2">
                <SentimentBadge s={r.sentiment} />
                <StatusBadge s={(reviewState[r.id]?.status || r.status) as any} />
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        {sel ? (
          <ReviewDetail
            review={sel}
            reviewsUrl={report.reviewsUrl || ''}
            state={reviewState[sel.id]}
            setState={(next) => setReviewState((prev) => ({ ...prev, [sel.id]: next }))}
            flashToast={flashToast}
          />
        ) : (
          <div className="card p-10 text-center text-muted text-sm">Select a review to see the agent&rsquo;s draft.</div>
        )}
      </div>
    </div>
  );
}

function ReviewDetail({
  review, reviewsUrl, state, setState, flashToast,
}: {
  review: Report['reviews'][number];
  reviewsUrl: string;
  state?: { status: string; reply: string };
  setState: (s: { status: string; reply: string }) => void;
  flashToast: (msg: string) => void;
}) {
  const reply = state?.reply ?? review.draftedReply;
  const status = state?.status ?? review.status;
  const linkTo = review.reviewLink || reviewsUrl;

  function sendOnGoogle() {
    navigator.clipboard.writeText(reply).catch(() => {});
    setState({ status: 'replied', reply });
    flashToast('Reply copied. Paste into Google Reviews →');
    if (linkTo) window.open(linkTo, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs serif font-bold"
            style={{ backgroundImage: 'linear-gradient(120deg,#EC4899,#A855F7,#6366F1)' }}>
            {AGENTS[review.agent].letter}
          </span>
          <span className="text-sm font-semibold serif">{AGENTS[review.agent].name}</span>
          <span className="text-xs text-muted">· {AGENTS[review.agent].role}</span>
        </div>
        <Stars n={review.rating} />
      </div>
      <div className="p-5 space-y-5">
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="text-[10px] uppercase tracking-widest text-muted">{review.author}</div>
            {linkTo && (
              <a href={linkTo} target="_blank" rel="noreferrer" className="text-[10px] uppercase tracking-widest text-muted hover:text-ink hover:underline inline-flex items-center gap-1">
                view on google
                <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                  <path d="M3 3h6v6M3 9L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </a>
            )}
          </div>
          <p className="text-sm leading-relaxed bg-stone-50 border border-stone-200 rounded-lg p-3">{review.text}</p>
          <div className="flex gap-2 mt-2 flex-wrap">
            {review.themes.map((t, i) => (
              <span key={i} className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-stone-100 border border-stone-200 text-stone-700">{t}</span>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest grad-text font-semibold mb-2">Echo&rsquo;s draft reply</div>
          <textarea
            value={reply}
            onChange={(e) => setState({ status, reply: e.target.value })}
            className="w-full p-3 rounded-lg border border-stone-200 bg-white text-sm leading-relaxed resize-y min-h-[140px]"
          />
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <button onClick={sendOnGoogle} className="btn-grad text-sm px-4 py-2">
              Send on Google →
            </button>
            <button
              onClick={() => { navigator.clipboard.writeText(reply); flashToast('Reply copied.'); }}
              className="text-sm px-3 py-2 rounded-full border border-stone-200 hover:bg-stone-50"
            >
              Copy only
            </button>
            <button
              onClick={() => setState({ status: 'archived', reply })}
              className="text-sm px-3 py-2 rounded-full border border-stone-200 hover:bg-stone-50"
            >
              Archive
            </button>
            <span className="ml-auto"><StatusBadge s={status as any} /></span>
          </div>
          <p className="text-[10px] text-muted mt-2">
            <b>Send on Google</b> copies your reply and opens the review on Google Maps — paste into the reply box. Auto-send via Google&rsquo;s Reply API requires Google&rsquo;s app verification (~2 weeks); coming next.
          </p>
        </div>
      </div>
    </div>
  );
}

function ActionItems({ items, patterns }: { items: string[]; patterns: string[] }) {
  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="text-[10px] uppercase tracking-widest text-muted mb-4 flex items-center gap-2">
          <AgentDot k="atlas" /> Atlas · this week&rsquo;s action items
        </div>
        {items.length > 0 ? (
          <ul className="space-y-3">
            {items.map((it, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="serif font-bold grad-text text-xl shrink-0 leading-none">{String(i + 1).padStart(2, '0')}</span>
                <span className="text-sm leading-relaxed">{it}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No actions surfaced this week.</p>
        )}
      </div>
      {patterns.length > 0 && (
        <div className="card p-6">
          <div className="text-[10px] uppercase tracking-widest text-muted mb-4">Emerging patterns</div>
          <ul className="space-y-3">
            {patterns.map((p, i) => (
              <li key={i} className="text-sm leading-relaxed">{p}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MenuIntel({ mentions }: { mentions: { dish: string; sentiment: string; mentions: number }[] }) {
  return (
    <div className="card p-6">
      <div className="text-[10px] uppercase tracking-widest text-muted mb-4 flex items-center gap-2">
        <AgentDot k="sage" /> Sage · dishes mentioned in reviews
      </div>
      {mentions.length > 0 ? (
        <ul className="divide-y divide-stone-100">
          {mentions.map((m, i) => (
            <li key={i} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <span className="serif text-lg">{m.dish}</span>
                <SentimentBadge s={m.sentiment as any} />
              </div>
              <span className="text-sm text-muted">{m.mentions} mention{m.mentions === 1 ? '' : 's'}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No specific dishes mentioned by name yet.</p>
      )}
    </div>
  );
}

function Competitors({ items }: { items: { name: string; rating?: number; totalReviews?: number; takeaway: string }[] }) {
  return (
    <div className="card p-6">
      <div className="text-[10px] uppercase tracking-widest text-muted mb-4 flex items-center gap-2">
        <AgentDot k="argus" /> Argus · nearby competitors
      </div>
      {items.length > 0 ? (
        <div className="space-y-4">
          {items.map((c, i) => (
            <div key={i} className="border-l-2 pl-4" style={{ borderImage: 'linear-gradient(180deg,#EC4899,#A855F7) 1' }}>
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="serif text-xl">{c.name}</span>
                {c.rating !== undefined && <span className="text-sm text-muted">★ {c.rating.toFixed(1)}</span>}
                {c.totalReviews !== undefined && <span className="text-xs text-muted">· {c.totalReviews.toLocaleString()} reviews</span>}
              </div>
              <p className="text-sm mt-1">{c.takeaway}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">Argus is still scanning the area.</p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card p-5 text-center">
      <div className="serif text-3xl">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-muted mt-1">{label}</div>
    </div>
  );
}

function FilterChip({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full border transition ${
        active ? 'bg-ink text-white border-ink' : 'bg-white border-stone-200 text-muted hover:bg-stone-50'
      }`}
    >
      {children}
    </button>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`w-2 h-2 rounded-full ${i <= n ? 'bg-amber-400' : 'bg-stone-200'}`} />
      ))}
    </div>
  );
}

function SentimentBadge({ s }: { s: 'positive' | 'mixed' | 'negative' }) {
  const map = {
    positive: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    mixed: 'bg-amber-50 text-amber-800 border-amber-200',
    negative: 'bg-rose-50 text-rose-700 border-rose-200',
  } as const;
  return <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${map[s] || map.mixed}`}>{s}</span>;
}

function StatusBadge({ s }: { s: 'new' | 'reply-drafted' | 'replied' | 'archived' }) {
  const map = {
    new: 'bg-blue-50 text-blue-700 border-blue-200',
    'reply-drafted': 'bg-purple-50 text-purple-700 border-purple-200',
    replied: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    archived: 'bg-stone-100 text-stone-600 border-stone-200',
  } as const;
  return <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${map[s] || map.new}`}>{s}</span>;
}

function AgentDot({ k }: { k: AgentKey }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] serif font-bold"
        style={{ backgroundImage: 'linear-gradient(120deg,#EC4899,#A855F7,#6366F1)' }}>
        {AGENTS[k].letter}
      </span>
      <span className="serif text-xs">{AGENTS[k].name}</span>
    </span>
  );
}
