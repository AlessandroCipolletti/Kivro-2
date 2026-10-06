import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuthService } from '../../src/auth/server.js';
import { getSellerProfile } from '../../../../packages/persistence/src/seller-profiles.js';
import SellerProfileForm from './seller-profile-form';

export const dynamic = 'force-dynamic';

export default async function SellerPage() {
  const service = getAuthService();
  const session = await service.auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in?callbackURL=/seller');
  const profile = await getSellerProfile(service.database, session.user.id);
  const acknowledged = profile?.executionModelAcknowledged === true;
  return <main className="site-shell">
    <header className="site-header"><Link href="/" className="brand" aria-label="Kivro home"><span className="brand-mark">K</span><span>Kivro</span></Link>
      <nav aria-label="Main navigation"><Link href="/account" className="nav-link">Account</Link><span className="seller-nav-label">Seller workspace</span></nav></header>
    <section className="seller-layout">
      <div className="seller-heading"><p className="eyebrow"><span className="status-dot" /> Seller workspace</p>
        <h1>Build a useful service.<br /><em>Keep control of the work.</em></h1>
        <p>Kivro runs approved jobs in an isolated workspace on your connected computer. You choose the capabilities and resources you offer. Your machine and any model or provider usage are your operating costs.</p>
      </div>
      <div className="seller-panel"><div className="seller-panel-top"><span className="form-eyebrow">First publication</span><span className="seller-stage">{acknowledged ? 'Profile created' : profile ? 'Confirmation needed' : 'Start here'}</span></div>
        <h2>{profile ? profile.displayName : 'Name your seller workspace'}</h2>
        {acknowledged ? <p className="seller-muted">Your seller profile is a draft. Nothing is listed or available to buyers.</p>
          : <><p className="seller-muted">{profile ? 'Confirm the local execution model before continuing.' : 'This is the public name buyers will see. Your payout identity is handled separately.'}</p><SellerProfileForm defaultName={profile?.displayName ?? session.user.name} existingProfile={Boolean(profile)} /></>}
        <div className="seller-steps" aria-label="Publication steps">
          <div className={acknowledged ? 'seller-step current' : 'seller-step'}><span>01</span><div><strong>Connect Worker</strong><p>Pair the computer that will run approved jobs.</p></div><b>{acknowledged ? 'Next' : 'Locked'}</b></div>
          <div className="seller-step"><span>02</span><div><strong>Choose what to sell</strong><p>Inspect discoveries, then select each skill and resource yourself.</p></div><b>Pending</b></div>
          <div className="seller-step"><span>03</span><div><strong>Review access and test</strong><p>Confirm permissions, inference, readiness and your costs.</p></div><b>Pending</b></div>
          <div className="seller-step"><span>04</span><div><strong>Publish</strong><p>Set price, availability and capacity after all checks pass.</p></div><b>Pending</b></div>
        </div>
        <p className="seller-footnote">Discovery never publishes a skill or grants access. Each permission needs your explicit approval.</p>
      </div>
    </section>
    <footer className="site-footer"><span>© 2026 Kivro</span><span>Independent work, clear boundaries.</span></footer>
  </main>;
}
