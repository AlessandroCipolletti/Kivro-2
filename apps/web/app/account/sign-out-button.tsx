'use client';

import { useEffect, useState } from 'react';

export default function SignOutButton() {
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  return <button type="button" className="nav-link" style={{ border: 0, background: 'transparent' }} disabled={!ready || busy} onClick={async () => {
    setBusy(true);
    try {
      const response = await fetch('/api/auth/sign-out', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', credentials: 'same-origin' });
      if (response.ok) window.location.assign('/sign-in');
      else setBusy(false);
    } catch { setBusy(false); }
  }}>{busy ? 'Signing out…' : 'Sign out'}</button>;
}
