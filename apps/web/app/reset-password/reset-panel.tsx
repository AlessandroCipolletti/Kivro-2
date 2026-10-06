'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';

export default function ResetPanel() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  useEffect(() => { setToken(new URLSearchParams(window.location.search).get('token')); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setNotice(null);
    try {
      const response = await fetch(`/api/auth/${token ? 'reset-password' : 'request-password-reset'}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify(token ? { token, newPassword: password }
          : { email: email.trim().toLowerCase(), redirectTo: '/reset-password' }),
      });
      if (!response.ok) {
        setNotice({ kind: 'error', text: response.status === 429 ? 'Too many requests. Please wait before trying again.'
          : token ? 'This link has expired or was already used. Request a new one.' : 'We could not process your request. Please try again.' });
        return;
      }
      setNotice({ kind: 'success', text: token ? 'Password updated. You can sign in with your new password.'
        : 'If this address has an account, a recovery link is on its way.' });
      if (token) { setToken(null); setPassword(''); }
    } catch { setNotice({ kind: 'error', text: 'Connection lost. Please try again.' }); }
    finally { setBusy(false); }
  }

  return <div className="auth-card"><Link href="/sign-in" className="return-link">← Back to sign in</Link>
    <p className="form-eyebrow">Account recovery</p><h2>{token ? 'Choose a new password' : 'Reset your password'}</h2>
    <p className="card-copy">{token ? 'Use a password you have not used before.' : 'Enter your email and we will send a secure link if an account exists. You can also use it to add a password to an account created with Google.'}</p>
    {notice && <p className={`notice ${notice.kind}`} role="status" aria-live="polite">{notice.text}</p>}
    <form className="auth-form" onSubmit={submit}>
      {token ? <div className="field"><label htmlFor="new-password">New password</label><input id="new-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 12 characters" /></div>
        : <div className="field"><label htmlFor="reset-email">Email address</label><input id="reset-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></div>}
      <button type="submit" className="full-button" disabled={busy}>{busy ? 'Please wait…' : token ? 'Update password' : 'Send recovery link'}</button>
    </form>
  </div>;
}
