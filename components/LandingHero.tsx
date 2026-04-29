'use client';
import { useEffect, useState } from 'react';
import { AGENT_LIST } from '@/lib/agents';
import SignInModal from './SignInModal';

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
  echoSampleReplySource?: {
    authorName: string;
    authorUrl: string | null;
    reviewLink: string | null;
    rating: number;
    time: number;
    relativeTime: string | null;
    fullText: string;
  } | null;
  atlasActionItems: string[];
  sageMenuMentions: { dish: string; sentiment: string; mentions: number }[];
  argusCompetitors: { name: string; rating?: number; totalReviews?: number; takeaway: string }[];
  reviews: any[];
};

export default function LandingHero() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHost, setLoadingHost] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [autoCheckoutId, setAutoCheckoutId] = useState<string | null>(null);

  // Resume after Google sign-in: ?resume=<reportId>
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const rid = params.get('resume');
    if (!rid) return;
    try {
      const raw = localStorage.getItem(rid);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.report) {
        setReport(parsed.report);
        setAutoCheckoutId(rid);
        window.history.replaceState({}, '', '/');
        setTimeout(() => {
          document.getElementById('preview-anchor')?.scrollIntoView({ behavior: 'smooth' });
        }, 200);
      }
    } catch {}
  }, []);

  function normalizeUrl(raw: string): string | null {
    let v = raw.trim();
    if (!v) return null;
    if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
    try {
      const u = new URL(v);
      if (!u.hostname.includes('.')) return null;
      return u.toString().replace(/\/$/, '');
    } catch {
      return null;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setReport(null);
    const target = normalizeUrl(url);
    if (!target) {
      setError("That doesn't look like a valid website. Try yourrestaurant.com");
      return;
    }
    try { setLoadingHost(new URL(target).hostname.replace(/^www\./, '')); } catch { setLoadingHost(''); }
    setLoading(true);
    try {
      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target }),
      });
      const text = await res.text();
      let data: any = null;
      try { data = JSON.parse(text); } catch {
        if (res.status === 504) throw new Error('The team took longer than expected — try again, or try a different URL.');
        throw new Error('Server returned an unexpected response.');
      }
      if (!res.ok) throw new Error(data.error || 'Could not generate report.');
      setReport(data);
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="blob blob-pink" />
        <div className="blob blob-purple" />
        <div className="blob blob-indigo" />
      </div>

      <nav className="relative z-10 max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl serif font-semibold tracking-tight">
            <span className="grad-text">Bloom</span>
          </span>
        </div>
        <div className="text-sm text-muted">
          <a href="#team" className="hover:underline">The team</a>
          <span className="mx-3">·</span>
          <a href="#playbook" className="hover:underline">The playbook</a>
        </div>
      </nav>

      <section className="relative z-10 max-w-5xl mx-auto px-6 pt-16 md:pt-24 pb-20 text-center">
        <span className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-muted mb-8 animate-float">
          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundImage: 'linear-gradient(120deg,#EC4899,#A855F7)' }} />
          Built by Silicon Valley&rsquo;s top AI operators for local restaurants
        </span>

        <h1 className="serif text-6xl md:text-8xl leading-[0.98] tracking-tight">
          You&rsquo;re losing customers<br />
          <em className="italic grad-text">you&rsquo;ll never know about.</em>
        </h1>

        <p className="mt-8 text-lg md:text-2xl text-muted max-w-3xl mx-auto leading-relaxed">
          Paste your URL. Get the full <span className="text-ink font-medium">Restaurant Intelligence Suite</span> — a weekly action plan, AI-drafted replies for every review, menu optimization, sentiment trends, and a live competitor watch dashboard.
          <span className="block mt-3 text-ink">Run by a team of <span className="font-medium">five AI agents.</span> <span className="font-medium">Free preview. No signup.</span></span>
        </p>

        <form onSubmit={handleSubmit} className="mt-14 max-w-2xl mx-auto">
          <div className="flex flex-col md:flex-row gap-4 items-stretch">
            <div className="glow-cta flex-1">
              <div className="glow-cta-inner">
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="yourrestaurant.com"
                  className="w-full px-7 py-5 text-lg outline-none rounded-full bg-transparent placeholder:text-stone-400"
                />
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-grad text-lg px-7 py-5">
              {loading ? 'Agents working…' : 'Deploy team of agents →'}
            </button>
          </div>
          <p className="mt-5 text-xs text-muted max-w-xl mx-auto">
            We pull every Google review, analyze sentiment + themes, draft replies, and prepare a free intelligence preview. Takes about 60–90 seconds.
          </p>
          {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        </form>

        <div className="mt-16 flex flex-wrap justify-center gap-x-8 gap-y-3 text-xs uppercase tracking-widest text-muted">
          <span>5 specialized agents</span>
          <span>every google review read</span>
          <span>drafts + insights + dashboard</span>
          <span>no credit card</span>
        </div>

        {loading && <RebuildLoader hostname={loadingHost} />}
        {report && (
          <>
            <div id="preview-anchor" />
            <ReportPreview report={report} autoCheckoutId={autoCheckoutId} />
          </>
        )}
      </section>

      <section id="team" className="relative z-10 max-w-6xl mx-auto px-6 py-24 border-t border-stone-200">
        <div className="text-center mb-16">
          <span className="inline-block text-xs uppercase tracking-widest text-muted mb-4">The lineup</span>
          <h2 className="serif text-5xl md:text-6xl tracking-tight">
            Meet your <span className="grad-text">team.</span>
          </h2>
          <p className="mt-4 text-muted text-lg max-w-2xl mx-auto">
            Five specialized agents. Each tuned for a single job. Together they handle every review you get.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-24">
          {AGENT_LIST.map((a) => (
            <AgentChip key={a.key} letter={a.letter} name={a.name} role={a.role} />
          ))}
        </div>

        <div className="space-y-32 md:space-y-40">
          {AGENT_LIST.map((a, i) => (
            <StepRow
              key={a.key}
              n={String(i + 1).padStart(2, '0')}
              agent={`${a.name} · ${a.role}`}
              title={a.oneLiner}
              body={a.longBlurb}
              visual={<AgentVisual agentKey={a.key} />}
              reverse={i % 2 === 1}
            />
          ))}
        </div>

        <div className="text-center mt-24">
          <p className="text-muted text-lg">
            Then you review. Side-by-side. <span className="text-ink font-medium">If you love it, $10 unlocks the dashboard.</span>
          </p>
        </div>
      </section>

      <section id="playbook" className="relative z-10 max-w-6xl mx-auto px-6 py-24 border-t border-stone-200 text-center">
        <h2 className="serif text-4xl md:text-5xl tracking-tight mb-6">
          The <span className="grad-text">playbook.</span>
        </h2>
        <p className="max-w-2xl mx-auto text-muted text-lg md:text-xl leading-relaxed">
          Most restaurant owners never read all their reviews. They miss the patterns. They miss the openings. They miss the chance to win back a customer who just left a 2-star. Bloom reads every review with care, drafts every reply, and surfaces what to do this week — by a team of agents tuned for the job.
        </p>
        <a
          href="#top"
          onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          className="btn-grad mt-10 text-base"
        >
          Deploy AI Agents →
        </a>
      </section>

      <footer className="relative z-10 max-w-6xl mx-auto px-6 py-12 border-t border-stone-200 text-sm text-muted flex justify-between">
        <span>© 2026 Bloom Studio</span>
        <a href="/admin" className="hover:underline">Admin</a>
      </footer>
    </div>
  );
}

function AgentChip({ letter, name, role }: { letter: string; name: string; role: string }) {
  return (
    <div className="card p-4 flex items-center gap-3 transition-transform hover:-translate-y-1">
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold serif text-lg shrink-0"
        style={{ backgroundImage: 'linear-gradient(120deg,#EC4899,#A855F7,#6366F1)' }}
      >
        {letter}
      </div>
      <div className="min-w-0">
        <div className="serif text-base leading-tight">{name}</div>
        <div className="text-xs text-muted truncate">{role}</div>
      </div>
    </div>
  );
}

function StepRow({
  n, agent, title, body, visual, reverse,
}: { n: string; agent: string; title: string; body: string; visual: React.ReactNode; reverse: boolean }) {
  return (
    <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
      <div className={reverse ? 'md:order-2' : ''}>
        <div className="flex items-baseline gap-4 mb-4 flex-wrap">
          <div className="serif font-bold grad-text text-7xl md:text-9xl pb-2" style={{ lineHeight: 1.05 }}>{n}</div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-stone-200">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundImage: 'linear-gradient(120deg,#EC4899,#A855F7)' }} />
            <span className="text-xs font-mono uppercase tracking-wider text-muted">{agent}</span>
          </div>
        </div>
        <h3 className="serif text-3xl md:text-5xl tracking-tight">{title}</h3>
        <p className="mt-5 text-lg text-muted leading-relaxed max-w-md">{body}</p>
      </div>
      <div className={reverse ? 'md:order-1' : ''}>
        {visual}
      </div>
    </div>
  );
}

function AgentVisual({ agentKey }: { agentKey: string }) {
  if (agentKey === 'iris') return <ScanVisual />;
  if (agentKey === 'echo') return <ReplyVisual />;
  if (agentKey === 'atlas') return <ActionItemsVisual />;
  if (agentKey === 'sage') return <SentimentVisual />;
  if (agentKey === 'argus') return <CompetitorVisual />;
  return null;
}

function ScanVisual() {
  return (
    <div className="card overflow-hidden shadow-2xl">
      <div className="px-4 py-3 border-b border-stone-200 bg-stone-50 flex items-center gap-2">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-stone-300" />
          <span className="w-2.5 h-2.5 rounded-full bg-stone-300" />
          <span className="w-2.5 h-2.5 rounded-full bg-stone-300" />
        </div>
        <div className="flex-1 ml-2 px-3 py-1.5 bg-white rounded-md text-xs font-mono text-muted border border-stone-200">
          google.com/maps · reviews
        </div>
      </div>
      <div className="relative p-6 h-56 overflow-hidden bg-white">
        <div className="space-y-3">
          {[60, 84, 48, 75, 62, 40].map((w, i) => (
            <div key={i} className="flex gap-2 items-center">
              <div className="w-6 h-6 rounded-full bg-stone-200 shrink-0" />
              <div className="h-3 bg-stone-200 rounded" style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
        <div className="absolute inset-0 pointer-events-none"><div className="scan-beam" /></div>
        <div className="absolute bottom-3 right-4 text-[10px] uppercase tracking-widest grad-text font-semibold">
          reading…
        </div>
      </div>
    </div>
  );
}

function ReplyVisual() {
  return (
    <div className="card overflow-hidden shadow-2xl">
      <div className="px-5 py-3 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
        <span className="text-xs font-mono uppercase tracking-wider text-muted">Drafting reply</span>
        <span className="text-[10px] grad-text font-semibold uppercase tracking-widest">echo</span>
      </div>
      <div className="p-6 bg-white space-y-4">
        <div className="bg-stone-50 border border-stone-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-5 h-5 rounded-full bg-stone-300" />
            <div className="h-2 w-20 bg-stone-200 rounded" />
            <div className="ml-auto flex gap-0.5">
              {[0,1].map(i => <span key={i} className="w-2 h-2 rounded-full bg-amber-400" />)}
              {[0,1,2].map(i => <span key={i} className="w-2 h-2 rounded-full bg-stone-200" />)}
            </div>
          </div>
          <div className="space-y-1">
            <div className="h-2 bg-stone-200 rounded w-full" />
            <div className="h-2 bg-stone-200 rounded w-5/6" />
            <div className="h-2 bg-stone-200 rounded w-3/4" />
          </div>
        </div>
        <div className="border-l-2 pl-3" style={{ borderImage: 'linear-gradient(180deg,#EC4899,#A855F7) 1' }}>
          <div className="text-[10px] uppercase tracking-widest grad-text font-semibold mb-2">Echo&rsquo;s draft</div>
          <div className="space-y-1">
            <div className="code-line h-2 bg-stone-300 rounded w-full" />
            <div className="code-line h-2 bg-stone-300 rounded w-4/5" />
            <div className="code-line h-2 bg-stone-300 rounded w-5/6" />
            <div className="code-line h-2 bg-stone-300 rounded w-2/3" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionItemsVisual() {
  return (
    <div className="card overflow-hidden shadow-2xl">
      <div className="px-5 py-3 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
        <span className="text-xs font-mono uppercase tracking-wider text-muted">This week&rsquo;s action items</span>
        <span className="text-[10px] grad-text font-semibold uppercase tracking-widest">atlas</span>
      </div>
      <div className="p-6 bg-white space-y-3">
        {[78, 65, 82, 56].map((w, i) => (
          <div key={i} className="code-line flex items-start gap-3">
            <svg width="18" height="18" viewBox="0 0 18 18" className="shrink-0 mt-0.5">
              <circle cx="9" cy="9" r="8" fill="url(#al-grad)" />
              <text x="9" y="13" textAnchor="middle" fontSize="10" fill="white" fontFamily="ui-monospace,Menlo,monospace" fontWeight="bold">{i + 1}</text>
              <defs>
                <linearGradient id="al-grad" x1="0" y1="0" x2="18" y2="18">
                  <stop offset="0%" stopColor="#EC4899" />
                  <stop offset="100%" stopColor="#6366F1" />
                </linearGradient>
              </defs>
            </svg>
            <div className="flex-1 space-y-1.5">
              <div className="h-2.5 bg-stone-200 rounded" style={{ width: `${w}%` }} />
              <div className="h-1.5 bg-stone-100 rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SentimentVisual() {
  return (
    <div className="card overflow-hidden shadow-2xl">
      <div className="px-5 py-3 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
        <span className="text-xs font-mono uppercase tracking-wider text-muted">Sentiment trend · 30 days</span>
        <span className="text-[10px] grad-text font-semibold uppercase tracking-widest">sage</span>
      </div>
      <div className="p-6 bg-white">
        <svg viewBox="0 0 320 140" className="w-full h-32">
          <defs>
            <linearGradient id="sg" x1="0" y1="0" x2="320" y2="0">
              <stop offset="0%" stopColor="#EC4899" />
              <stop offset="50%" stopColor="#A855F7" />
              <stop offset="100%" stopColor="#6366F1" />
            </linearGradient>
            <linearGradient id="sgFill" x1="0" y1="0" x2="0" y2="140">
              <stop offset="0%" stopColor="#A855F7" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#A855F7" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0,90 C40,80 60,70 90,55 S150,45 180,40 220,35 260,28 300,22 320,18 L320,140 L0,140 Z" fill="url(#sgFill)" />
          <path d="M0,90 C40,80 60,70 90,55 S150,45 180,40 220,35 260,28 300,22 320,18" stroke="url(#sg)" strokeWidth="2.5" fill="none" />
          {[[0,90],[60,68],[120,55],[180,40],[240,30],[300,22]].map(([x,y], i) => (
            <circle key={i} cx={x} cy={y} r="3" fill="white" stroke="url(#sg)" strokeWidth="2" />
          ))}
        </svg>
        <div className="grid grid-cols-3 gap-3 mt-4 text-center">
          <div>
            <div className="serif text-2xl font-semibold">4.6</div>
            <div className="text-[10px] uppercase tracking-widest text-muted">avg rating</div>
          </div>
          <div>
            <div className="serif text-2xl font-semibold grad-text">+0.3</div>
            <div className="text-[10px] uppercase tracking-widest text-muted">trend 30d</div>
          </div>
          <div>
            <div className="serif text-2xl font-semibold">142</div>
            <div className="text-[10px] uppercase tracking-widest text-muted">reviews</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompetitorVisual() {
  const rows = [
    { name: 'Joe’s', rating: 4.7, w: 92 },
    { name: 'Mae’s', rating: 4.4, w: 84 },
    { name: 'You', rating: 4.6, w: 88, mine: true },
    { name: 'Tasty', rating: 4.1, w: 72 },
  ];
  return (
    <div className="card overflow-hidden shadow-2xl">
      <div className="px-5 py-3 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
        <span className="text-xs font-mono uppercase tracking-wider text-muted">Nearby · 1 mi</span>
        <span className="text-[10px] grad-text font-semibold uppercase tracking-widest">argus</span>
      </div>
      <div className="p-6 bg-white space-y-3">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={`text-sm w-12 ${r.mine ? 'serif font-bold grad-text' : 'text-muted'}`}>{r.name}</div>
            <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{
                width: `${r.w}%`,
                backgroundImage: r.mine ? 'linear-gradient(90deg,#EC4899,#A855F7,#6366F1)' : 'linear-gradient(90deg,#D1CEC5,#B0ADA4)'
              }} />
            </div>
            <div className="text-xs font-mono w-10 text-right">{r.rating}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RebuildLoader({ hostname }: { hostname: string }) {
  const STAGES = [
    { letter: 'I', agent: 'Iris', title: hostname ? `is reading ${hostname}` : 'is reading reviews', subTasks: ['Finding your Google profile…', 'Pulling reviews…', 'Sorting by recency…', 'Counting ratings…'] },
    { letter: 'S', agent: 'Sage', title: 'is finding the patterns', subTasks: ['Analyzing sentiment…', 'Tagging dishes…', 'Tracking themes…', 'Calculating trends…'] },
    { letter: 'A', agent: 'Atlas', title: 'is making this week’s plan', subTasks: ['Spotting recurring issues…', 'Drafting fixes…', 'Prioritizing impact…'] },
    { letter: 'E', agent: 'Echo', title: 'is drafting your replies', subTasks: ['Reading each review…', 'Matching the tone…', 'Drafting warm replies…'] },
    { letter: 'G', agent: 'Argus', title: 'is watching the competition', subTasks: ['Mapping nearby spots…', 'Comparing ratings…', 'Finding openings…'] },
  ] as const;

  const [stage, setStage] = useState(0);
  const [tick, setTick] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => { const id = setInterval(() => setStage((s) => (s + 1) % STAGES.length), 8000); return () => clearInterval(id); }, []);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 2000); return () => clearInterval(id); }, []);
  useEffect(() => { const id = setInterval(() => setElapsed((s) => s + 1), 1000); return () => clearInterval(id); }, []);

  const cur = STAGES[stage];
  const subTask = cur.subTasks[tick % cur.subTasks.length];
  const continuousProgress = Math.min(95, (elapsed / 75) * 100);

  return (
    <div className="mt-14 max-w-3xl mx-auto">
      <div className="card overflow-hidden shadow-2xl">
        <div className="h-1 bg-stone-100 relative overflow-hidden">
          <div className="h-full transition-all duration-1000 ease-linear"
            style={{ width: `${continuousProgress}%`, backgroundImage: 'linear-gradient(90deg, #EC4899, #A855F7, #6366F1)' }} />
        </div>
        <div className="px-6 py-5 flex items-center gap-4 border-b border-stone-200 bg-stone-50">
          <div key={stage}
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold serif text-lg shrink-0 shadow-lg"
            style={{ backgroundImage: 'linear-gradient(120deg,#EC4899,#A855F7,#6366F1)', animation: 'glowPulse 2s ease-in-out infinite' }}>
            {cur.letter}
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-muted">Step {stage + 1} of {STAGES.length} · {elapsed}s elapsed</div>
            <div className="text-base md:text-lg leading-tight mt-0.5">
              <span className="grad-text font-bold">{cur.agent}</span>{' '}
              <span className="text-ink">{cur.title}</span>
            </div>
            <div key={subTask} className="text-xs text-muted mt-1.5 truncate fade-in-task">↳ {subTask}</div>
          </div>
        </div>
      </div>
      <p className="text-center text-sm text-muted mt-4">
        Sit tight — your team is working. <span className="text-ink font-medium">Estimated wait: 60–90 seconds.</span> Sometimes faster.
      </p>
    </div>
  );
}

function ReportPreview({ report, autoCheckoutId }: { report: Report; autoCheckoutId?: string | null }) {
  const sentimentColor = report.overallSentiment === 'positive'
    ? 'text-emerald-700' : report.overallSentiment === 'negative' ? 'text-rose-700' : 'text-amber-700';

  return (
    <div className="mt-16 text-left">
      <div className="text-center mb-10">
        <h3 className="serif text-3xl md:text-4xl">
          A look inside{' '}
          <span className="grad-text">{report.placeName}</span>
        </h3>
        {report.address && <p className="text-sm text-muted mt-2">{report.address}</p>}
        {report.reviewsUrl && (
          <a
            href={report.reviewsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-xs text-muted hover:text-ink hover:underline"
          >
            verify on Google
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M3 3h6v6M3 9L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </a>
        )}
      </div>

      {/* Hero stats row */}
      <div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto mb-10">
        <Stat label="Rating" value={report.rating ? report.rating.toFixed(1) : '—'} />
        <Stat label="Total reviews" value={report.totalReviews?.toLocaleString() || '—'} />
        <Stat label="Sentiment" value={
          <span className={`${sentimentColor} font-semibold capitalize`}>{report.overallSentiment}</span>
        } />
      </div>

      {/* Themes */}
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-12">
        <div className="card p-6">
          <div className="text-[10px] uppercase tracking-widest text-muted mb-3">Top positive themes</div>
          <ul className="space-y-2">
            {report.positiveThemes.slice(0, 5).map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ backgroundImage: 'linear-gradient(120deg,#10B981,#059669)' }} />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-6">
          <div className="text-[10px] uppercase tracking-widest text-muted mb-3">Top negative themes</div>
          {report.negativeThemes.length > 0 ? (
            <ul className="space-y-2">
              {report.negativeThemes.slice(0, 5).map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0 bg-rose-500" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No common complaints. Nice.</p>
          )}
        </div>
      </div>

      {/* Sample drafted reply */}
      {report.echoSampleReply && (
        <div className="max-w-3xl mx-auto mb-12">
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-muted">Echo drafted a reply</span>
              <span className="text-[10px] grad-text font-bold uppercase tracking-widest">sample</span>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="text-[10px] uppercase tracking-widest text-muted">A real review on Google</div>
                    {report.echoSampleReplySource && (
                      <>
                        <span className="text-stone-300">·</span>
                        <span className="text-xs font-medium text-ink">{report.echoSampleReplySource.authorName}</span>
                        <Stars n={report.echoSampleReplySource.rating} />
                        {report.echoSampleReplySource.relativeTime && (
                          <span className="text-[10px] text-muted">{report.echoSampleReplySource.relativeTime}</span>
                        )}
                      </>
                    )}
                  </div>
                  {(report.echoSampleReplySource?.reviewLink || report.reviewsUrl) && (
                    <a
                      href={report.echoSampleReplySource?.reviewLink || report.reviewsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted hover:text-ink hover:underline"
                    >
                      view this review on google
                      <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                        <path d="M3 3h6v6M3 9L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </a>
                  )}
                </div>
                <p className="text-sm italic leading-relaxed">
                  &ldquo;{report.echoSampleReplySource?.fullText || report.echoSampleReply.reviewSnippet}&rdquo;
                </p>
              </div>
              <div className="border-l-2 pl-4 ml-2" style={{ borderImage: 'linear-gradient(180deg,#EC4899,#A855F7) 1' }}>
                <div className="text-[10px] uppercase tracking-widest grad-text font-semibold mb-1">Echo&rsquo;s draft reply</div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{report.echoSampleReply.reply}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Locked dashboard preview */}
      <div className="max-w-4xl mx-auto mb-8 relative">
        <div className="card overflow-hidden filter blur-sm pointer-events-none select-none">
          <div className="px-5 py-3 border-b border-stone-200 bg-stone-50">
            <span className="text-xs font-mono uppercase tracking-wider text-muted">Dashboard · Atlas / Sage / Argus</span>
          </div>
          <div className="p-6 grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="h-3 w-24 bg-stone-200 rounded" />
              <div className="h-2 w-full bg-stone-100 rounded" />
              <div className="h-2 w-5/6 bg-stone-100 rounded" />
              <div className="h-2 w-3/4 bg-stone-100 rounded" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-24 bg-stone-200 rounded" />
              <div className="h-2 w-full bg-stone-100 rounded" />
              <div className="h-2 w-5/6 bg-stone-100 rounded" />
              <div className="h-2 w-3/4 bg-stone-100 rounded" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-24 bg-stone-200 rounded" />
              <div className="h-2 w-full bg-stone-100 rounded" />
              <div className="h-2 w-5/6 bg-stone-100 rounded" />
              <div className="h-2 w-3/4 bg-stone-100 rounded" />
            </div>
          </div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-xs uppercase tracking-widest text-muted">Locked · {report.atlasActionItems.length} action items · {report.sageMenuMentions.length} menu mentions · {report.argusCompetitors.length} competitor insights · {report.reviews.length} drafted replies</div>
          </div>
        </div>
      </div>

      <PaywallCTA report={report} autoCheckoutId={autoCheckoutId} />
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

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`w-1.5 h-1.5 rounded-full ${i <= n ? 'bg-amber-400' : 'bg-stone-300'}`} />
      ))}
    </span>
  );
}

function PaywallCTA({ report, autoCheckoutId }: { report: Report; autoCheckoutId?: string | null }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [signInOpen, setSignInOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function startCheckout(existingId?: string) {
    setBusy(true); setErr(null);
    try {
      const id = existingId || `bloom-report-${Date.now()}`;
      if (!existingId) {
        try {
          localStorage.setItem(id, JSON.stringify({ report, ts: Date.now() }));
        } catch {}
      }
      const r = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rebuildId: id,
          originalUrl: report.websiteResolved || '',
          placeId: report.placeId,
          placeName: report.placeName,
        }),
      });
      const text = await r.text();
      let data: any;
      try { data = JSON.parse(text); } catch { throw new Error('Server returned an unexpected response.'); }
      if (!r.ok) throw new Error(data.error || 'Checkout failed');
      if (data.requiresLogin) {
        setPendingId(id);
        setSignInOpen(true);
        setBusy(false);
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch (e: any) {
      setErr(e.message); setBusy(false);
    }
  }

  useEffect(() => {
    if (autoCheckoutId) startCheckout(autoCheckoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCheckoutId]);

  return (
    <div className="mt-12 text-center max-w-2xl mx-auto">
      <h4 className="serif text-2xl md:text-3xl tracking-tight">
        Want <span className="grad-text">full access?</span>
      </h4>
      <p className="mt-3 text-muted text-base md:text-lg">
        Unlock the dashboard. Drafted replies for every review, weekly action items, menu intelligence, competitor watch — all for <span className="text-ink font-medium">$10</span>.
      </p>
      <button type="button" onClick={() => startCheckout()} disabled={busy} className="btn-grad mt-6 text-lg px-8 py-5">
        {busy ? (autoCheckoutId ? 'Resuming checkout…' : 'Loading…') : 'Get full access · $10 →'}
      </button>
      {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
      <p className="mt-3 text-xs text-muted">Sign in with Google · Pay via Stripe · Dashboard instantly</p>
      <SignInModal
        open={signInOpen}
        onClose={() => setSignInOpen(false)}
        callbackUrl={pendingId ? `/?resume=${pendingId}` : '/'}
      />
    </div>
  );
}
