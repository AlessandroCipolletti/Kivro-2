'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';

type Mode = 'sign-in' | 'create' | 'verification';
type Notice = { kind: 'error' | 'success'; text: string } | null;

async function submitAuth(path: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(`/api/auth${path}`, { method: 'POST', credentials: 'same-origin',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

function messageFor(status: number, fallback: string): string {
  if (status === 429) return 'Too many attempts. Please wait before trying again.';
  if (status === 403) return 'Please verify your email before signing in.';
  return fallback;
}

function returnPath():string{
  const value=new URLSearchParams(window.location.search).get('callbackURL');
  if(!value||!value.startsWith('/')||value.startsWith('//')||value.includes('\\')||
    [...value].some((character)=>character.charCodeAt(0)<32))return '/account';
  try{return new URL(value,window.location.origin).origin===window.location.origin?value:'/account';}
  catch{return '/account';}
}

export default function AuthPanel({ googleEnabled }: { googleEnabled: boolean }) {
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    setReady(true);
    const query = new URLSearchParams(window.location.search);
    if (query.get('mode') === 'create') setMode('create');
    if (query.get('verified') === '1') setNotice({ kind: 'success', text: 'Email verified. Sign in to continue.' });
    if (query.get('error')) setNotice({ kind: 'error', text: 'Google sign-in could not be completed. Please try again.' });
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setNotice(null);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const response = mode === 'create'
        ? await submitAuth('/sign-up/email', { name: name.trim(), email: normalizedEmail, password,
          callbackURL: '/sign-in?verified=1' })
        : await submitAuth('/sign-in/email', { email: normalizedEmail, password });
      if (!response.ok) {
        setNotice({ kind: 'error', text: messageFor(response.status, mode === 'create'
          ? 'We could not create this account. Review your details or use sign in.'
          : 'We could not sign you in. Check your details and try again.') });
        return;
      }
      if (mode === 'create') {
        setMode('verification');
        setPassword('');
        setNotice({ kind: 'success', text: 'Check your inbox for a verification link. You can close this page and return later.' });
      } else window.location.assign(returnPath());
    } catch {
      setNotice({ kind: 'error', text: 'Connection lost. Please try again.' });
    } finally { setBusy(false); }
  }

  async function resend() {
    if (busy) return;
    setBusy(true); setNotice(null);
    try {
      const response = await submitAuth('/send-verification-email', { email: email.trim().toLowerCase(), callbackURL: '/sign-in?verified=1' });
      setNotice(response.ok ? { kind: 'success', text: 'If this address needs verification, a new link is on its way.' }
        : { kind: 'error', text: messageFor(response.status, 'We could not send another link right now.') });
    } catch { setNotice({ kind: 'error', text: 'Connection lost. Please try again.' }); }
    finally { setBusy(false); }
  }

  async function googleSignIn() {
    if (!googleEnabled || busy) return;
    setBusy(true); setNotice(null);
    try {
      const response = await submitAuth('/sign-in/social', { provider: 'google', callbackURL: returnPath() });
      if (!response.ok) throw new Error('Google sign-in unavailable');
      const result: unknown = await response.json();
      const url = result && typeof result === 'object' && 'url' in result ? (result as { url?: unknown }).url : undefined;
      if (typeof url !== 'string' || !url.startsWith('https://accounts.google.com/')) throw new Error('Unexpected Google redirect');
      window.location.assign(url);
    } catch { setNotice({ kind: 'error', text: 'Google sign-in is unavailable right now. Please try again.' }); setBusy(false); }
  }

  return <div className="auth-card">
    {mode === 'verification' ? <>
      <p className="form-eyebrow">One more step</p><h2>Verify your email</h2>
      <p className="card-copy">We sent a link to <strong>{email}</strong>. Open it to activate your account, then sign in.</p>
      {notice && <p className={`notice ${notice.kind}`} role={notice.kind==='error'?'alert':'status'}>{notice.text}</p>}
      <button className="full-button" type="button" onClick={resend} disabled={busy||!ready}>{busy ? 'Sending…' : 'Resend verification link'}</button>
      <p className="auth-note">Already verified? <button type="button" className="form-link" disabled={!ready} onClick={() => { setMode('sign-in'); setNotice(null); }}>Sign in</button></p>
    </> : <>
      <p className="form-eyebrow">Welcome to Kivro</p><h2>{mode === 'create' ? 'Create your account' : 'Sign in to Kivro'}</h2>
      <p className="card-copy">{mode === 'create' ? 'Start with a verified email. You can use one account to buy and sell.' : 'Pick up where you left off.'}</p>
      <div className="auth-tabs" role="tablist" aria-label="Account access" onKeyDown={(event)=>{
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
        event.preventDefault();
        const next=event.key==='Home'?'sign-in':event.key==='End'?'create':
          mode==='create'?'sign-in':'create';
        setMode(next);setNotice(null);
        document.getElementById(`auth-tab-${next}`)?.focus();
      }}><button id="auth-tab-sign-in" type="button" className="auth-tab" role="tab" tabIndex={mode==='sign-in'?0:-1} aria-controls="auth-panel" aria-selected={mode === 'sign-in'} disabled={!ready} onClick={() => { setMode('sign-in'); setNotice(null); }}>Sign in</button><button id="auth-tab-create" type="button" className="auth-tab" role="tab" tabIndex={mode==='create'?0:-1} aria-controls="auth-panel" aria-selected={mode === 'create'} disabled={!ready} onClick={() => { setMode('create'); setNotice(null); }}>Create account</button></div>
      <div id="auth-panel" role="tabpanel" aria-labelledby={`auth-tab-${mode}`}>
      {notice && <p id="auth-notice" className={`notice ${notice.kind}`} role={notice.kind==='error'?'alert':'status'}>{notice.text}</p>}
      <form className="auth-form" onSubmit={onSubmit}>
        {mode === 'create' && <div className="field"><label htmlFor="full-name">Your name</label><input id="full-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={160} placeholder="Alex Morgan" /></div>}
        <div className="field"><label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={320} placeholder="you@example.com" /></div>
        <div className="field"><div className="form-row"><label htmlFor="password">Password</label>{mode === 'sign-in' && <Link href="/reset-password" className="form-link">Forgot password?</Link>}</div><input id="password" type="password" autoComplete={mode === 'create' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={mode === 'create' ? 12 : 1} maxLength={128} aria-describedby={mode==='create'?'password-help':undefined} placeholder="Enter your password" />{mode === 'create' && <p id="password-help" className="field-help">Use at least 12 characters.</p>}</div>
        <button type="submit" className="full-button" disabled={busy||!ready}>{busy ? 'Please wait…' : mode === 'create' ? 'Create account' : 'Sign in'}</button>
      </form>
      <div className="divider">or continue with</div>
      <button type="button" className="google-button" onClick={googleSignIn} disabled={busy || !googleEnabled || !ready}><span className="google-g" aria-hidden="true">G</span>Continue with Google</button>
      {!googleEnabled && <p className="auth-note">Google sign-in is unavailable right now.</p>}
      </div>
    </>}
  </div>;
}
