'use client';
import { useEffect, useState } from 'react';
import type { Lead } from '@/lib/types';

export default function AddLeadModal({
  open,
  onClose,
  onAdd,
  existingIds,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (lead: Lead) => void;
  existingIds: Set<string>;
}) {
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [city, setCity] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [type, setType] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  function reset() {
    setName(''); setWebsite(''); setCity(''); setStateCode('');
    setType(''); setOwnerName(''); setLinkedinUrl('');
    setContactEmail(''); setNotes(''); setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Restaurant name is required.');
      return;
    }
    if (!linkedinUrl.trim() && !contactEmail.trim()) {
      setError('At least one contact channel (email or LinkedIn) is required.');
      return;
    }

    setSubmitting(true);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    let id = `${slug}-new-${Date.now().toString(36)}`;
    while (existingIds.has(id)) {
      id = `${slug}-new-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
    }

    const websiteNormalized = website.trim()
      ? (website.trim().match(/^https?:\/\//) ? website.trim() : `https://${website.trim()}`)
      : '';

    const lead: Lead = {
      id,
      name: name.trim(),
      website: websiteNormalized,
      city: city.trim(),
      state: stateCode.trim().toUpperCase(),
      type: type.trim(),
      ownerName: ownerName.trim(),
      linkedinUrl: linkedinUrl.trim(),
      contactEmail: contactEmail.trim(),
      emails: contactEmail.trim() ? [contactEmail.trim()] : [],
      notes: notes.trim(),
      status: 'new',
      outreachSent: false,
      responded: false,
      internalNotes: '',
      enrichedAt: Date.now(),
    };

    onAdd(lead);
    setSubmitting(false);
    reset();
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-ink/30 backdrop-blur-sm" onClick={onClose} />
      <div className="w-[640px] max-w-full bg-white border-l border-stone-200 overflow-y-auto">
        <div className="px-7 pt-7 pb-4 border-b border-stone-200 flex items-center justify-between">
          <div>
            <h2 className="serif text-2xl font-semibold tracking-tight">
              Add a <span className="grad-text">new lead</span>
            </h2>
            <p className="text-xs text-muted mt-1">
              Rule: at least one of email or LinkedIn must be filled. Both is best.
            </p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink text-2xl leading-none px-2" aria-label="Close">×</button>
        </div>

        <form onSubmit={handleSubmit} className="px-7 py-6 flex flex-col gap-5">
          <Field label="Restaurant Name" required>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Phoebe's Diner" className="w-full px-3 py-2.5 rounded-lg border border-stone-200 bg-white text-sm outline-none focus:border-stone-400" required />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="City">
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Austin" className="w-full px-3 py-2.5 rounded-lg border border-stone-200 bg-white text-sm outline-none focus:border-stone-400" />
            </Field>
            <Field label="State">
              <input value={stateCode} onChange={(e) => setStateCode(e.target.value.toUpperCase().slice(0, 2))} placeholder="TX" maxLength={2} className="w-full px-3 py-2.5 rounded-lg border border-stone-200 bg-white text-sm outline-none focus:border-stone-400" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Cuisine Type">
              <input value={type} onChange={(e) => setType(e.target.value)} placeholder="Diner" className="w-full px-3 py-2.5 rounded-lg border border-stone-200 bg-white text-sm outline-none focus:border-stone-400" />
            </Field>
            <Field label="Website">
              <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="phoebesdiner.com" className="w-full px-3 py-2.5 rounded-lg border border-stone-200 bg-white text-sm outline-none focus:border-stone-400" />
            </Field>
          </div>

          <hr className="border-stone-200" />

          <Field label="Owner Name">
            <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Camden Stuerzenberger" className="w-full px-3 py-2.5 rounded-lg border border-stone-200 bg-white text-sm outline-none focus:border-stone-400" />
          </Field>

          <Field label="Owner Email" hint="Personal email gets responses. info@ / hello@ gets ignored.">
            <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="camden@phoebesdiner.com" className="w-full px-3 py-2.5 rounded-lg border border-stone-200 bg-white text-sm outline-none focus:border-stone-400" />
          </Field>

          <Field label="Owner LinkedIn URL">
            <input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://www.linkedin.com/in/camden-stuerzenberger-…" className="w-full px-3 py-2.5 rounded-lg border border-stone-200 bg-white text-sm outline-none focus:border-stone-400" />
          </Field>

          <Field label="Notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything worth remembering — multi-loc, James Beard winner…" className="w-full p-3 rounded-lg border border-stone-200 bg-white text-sm leading-relaxed min-h-[90px] outline-none focus:border-stone-400" />
          </Field>

          {error && (
            <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-stone-200">
            <button type="button" onClick={() => { reset(); onClose(); }} className="text-sm px-4 py-2 rounded-full bg-white border border-stone-200 hover:bg-stone-50">Cancel</button>
            <button type="submit" disabled={submitting} className="text-sm px-5 py-2 rounded-full bg-ink text-white hover:bg-stone-800 disabled:opacity-50">
              {submitting ? 'Saving…' : 'Add lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-muted block mb-1.5">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      {children}
      {hint && <span className="text-[11px] text-stone-400 mt-1 block italic">{hint}</span>}
    </label>
  );
}
