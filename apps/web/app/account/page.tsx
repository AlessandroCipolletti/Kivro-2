import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuthService } from '../../src/auth/server.js';
import SignOutButton from './sign-out-button';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const session = await getAuthService().auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');
  return <main className="site-shell"><header className="site-header"><Link href="/" className="brand"><span className="brand-mark">K</span><span>Kivro</span></Link><nav aria-label="Main navigation"><SignOutButton /></nav></header>
    <section className="auth-layout"><div className="auth-intro"><p className="eyebrow"><span className="status-dot" /> Account</p><h1>Welcome back,<br /><em>{session.user.name}.</em></h1><p>Your Kivro account is the place to follow work as a buyer and manage capabilities as a seller.</p></div>
      <div className="auth-card"><p className="form-eyebrow">Account details</p><h2>Your profile</h2><div className="account-grid"><div className="account-card"><h2>Email</h2><p>{session.user.email}</p></div><div className="account-card"><h2>Status</h2><p>{session.user.emailVerified ? 'Email verified' : 'Email verification required'}</p></div></div><p className="auth-note">Your buyer and seller activity share this account.</p><Link href="/seller" className="account-seller-link">Go to seller workspace <span aria-hidden="true">↗</span></Link></div></section>
    <footer className="site-footer"><span>© 2026 Kivro</span><span>Work with clear boundaries.</span></footer>
  </main>;
}
