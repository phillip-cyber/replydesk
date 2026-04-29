'use client';
import { useEffect, useState } from 'react';

export default function SuccessClient() {
  const [state, setState] = useState<'verifying' | 'paid' | 'failed'>('verifying');
  const [error, setError] = useState<string | null>(null);
  const [placeId, setPlaceId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (!sessionId) {
      setState('failed');
      setError('Missing session id.');
      return;
    }
    (async () => {
      try {
        const r = await fetch('/api/checkout/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
        const data = await r.json();
        if (!r.ok || !data.paid) throw new Error(data.error || 'Payment not confirmed.');
        setPlaceId(data.placeId);
        setState('paid');
        setTimeout(() => {
          window.location.href = data.placeId ? `/dashboard?placeId=${data.placeId}` : '/dashboard';
        }, 1800);
      } catch (e: any) {
        setState('failed');
        setError(e.message);
      }
    })();
  }, []);

  return (
    <main className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="blob blob-pink" />
        <div className="blob blob-purple" />
        <div className="blob blob-indigo" />
      </div>
      <div className="relative z-10 max-w-3xl mx-auto px-6 py-24 text-center">
        <a href="/" className="inline-block mb-12">
          <span className="text-2xl serif font-semibold tracking-tight">
            <span className="grad-text">Bloom</span>
          </span>
        </a>
        {state === 'verifying' && (
          <>
            <h1 className="serif text-4xl md:text-5xl tracking-tight">Confirming with Stripe…</h1>
            <p className="mt-3 text-muted">Booting your team.</p>
          </>
        )}
        {state === 'failed' && (
          <>
            <h1 className="serif text-4xl md:text-5xl tracking-tight">Couldn&rsquo;t verify your payment.</h1>
            <p className="mt-3 text-muted">{error || 'Try again or contact support.'}</p>
            <a href="/" className="btn-grad mt-8 text-base inline-flex">← Back to Bloom</a>
          </>
        )}
        {state === 'paid' && (
          <>
            <h1 className="serif text-5xl md:text-6xl tracking-tight">
              <span className="grad-text">You&rsquo;re in.</span>
            </h1>
            <p className="mt-4 text-lg md:text-xl text-muted">
              Iris, Echo, Atlas, Sage and Argus are taking their stations. Sending you to the dashboard…
            </p>
            <div className="mt-10">
              <div className="w-12 h-12 mx-auto rounded-full border-2 border-stone-200 border-t-pink-500 animate-spin" />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
