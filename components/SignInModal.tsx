'use client';
import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';

export default function SignInModal({
  open,
  onClose,
  callbackUrl,
}: {
  open: boolean;
  onClose: () => void;
  callbackUrl: string;
}) {
  const [email, setEmail] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

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

  if (!open) return null;

  async function sendEmailLink() {
    setEmailErr(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailErr('Enter a valid email.');
      return;
    }
    setEmailBusy(true);
    try {
      const r = await fetch('/api/auth/email-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, callbackUrl }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed to send link.');
      setEmailSent(true);
    } catch (e: any) {
      setEmailErr(e.message);
    } finally {
      setEmailBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8"
      onClick={onClose}
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" />

      {/* modal */}
      <div className="relative z-10 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="glow-cta">
          <div className="glow-cta-inner p-8 md:p-10" style={{ borderRadius: '1.25rem' }}>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-stone-400 hover:bg-stone-100 hover:text-ink transition"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>

            <div className="text-center mb-6">
              <div className="text-2xl serif font-semibold tracking-tight">
                <span className="grad-text">Bloom</span>
              </div>
              <h2 className="serif text-2xl md:text-3xl mt-3 leading-tight">
                Sign in to <em className="italic grad-text">unlock</em>
              </h2>
              <p className="text-sm text-muted mt-2">$10 one-time. Your dashboard waits on the other side.</p>
            </div>

            <button
              type="button"
              onClick={() => signIn('google', { callbackUrl })}
              className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-full border border-stone-200 bg-white hover:bg-stone-50 transition text-sm font-medium"
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4" />
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
                <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05" />
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-stone-200" />
              <span className="text-[10px] uppercase tracking-widest text-muted">or with email</span>
              <div className="flex-1 h-px bg-stone-200" />
            </div>

            {emailSent ? (
              <div className="text-center text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                Check your inbox — we sent a sign-in link to <b>{email}</b>.
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    autoComplete="email"
                    className="w-full px-4 py-3 rounded-full border border-stone-200 bg-paper outline-none text-sm focus:border-stone-400"
                  />
                  <button
                    type="button"
                    onClick={sendEmailLink}
                    disabled={emailBusy}
                    className="w-full px-4 py-3 rounded-full bg-ink text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
                  >
                    {emailBusy ? 'Sending link…' : 'Email me a sign-in link'}
                  </button>
                </div>
                {emailErr && <p className="mt-2 text-xs text-rose-600">{emailErr}</p>}
              </>
            )}

            <p className="text-[10px] text-muted text-center mt-6">
              By continuing you agree to Bloom&rsquo;s terms. We&rsquo;ll only use your email to sign you in.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
