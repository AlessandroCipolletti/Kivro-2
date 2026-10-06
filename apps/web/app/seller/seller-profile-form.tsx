'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function SellerProfileForm({ defaultName, existingProfile }: Readonly<{ defaultName: string; existingProfile: boolean }>) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(defaultName);
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setReady(true), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true); setError('');
    try {
      const response = await fetch('/api/seller/profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, executionModelConfirmed: confirmed }), credentials: 'same-origin',
      });
      if (!response.ok) {
        if (response.status === 403) setError('Verify your email and make sure your account is active before selling.');
        else setError('We could not create your seller profile. Check the name and try again.');
        return;
      }
      router.refresh();
    } catch { setError('The connection was interrupted. Try again.'); }
    finally { setSubmitting(false); }
  }

  return <form className="seller-form" onSubmit={submit}>
    <div className="field"><label htmlFor="seller-display-name">Public seller name</label>
      <input id="seller-display-name" name="displayName" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={120} autoComplete="organization" disabled={!ready || existingProfile} required /></div>
    <label className="seller-ack"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={!ready} required />
      <span>I understand approved jobs will run in a separate restricted environment on my computer. I provide the machine and pay any model or provider costs. Kivro will ask me to approve each resource before publishing.</span></label>
    {error && <p role="alert" className="notice error">{error}</p>}
    <button className="primary-button" type="submit" disabled={!ready || submitting || !confirmed}>{submitting ? 'Saving…' : existingProfile ? 'Confirm and continue' : 'Create seller profile'} <span aria-hidden="true">↗</span></button>
  </form>;
}
