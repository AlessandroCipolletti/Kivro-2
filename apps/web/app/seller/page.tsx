import { ProductHeader } from '../ui/product-header';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuthService } from '../../src/auth/server.js';
import { getSellerProfile } from '../../../../packages/persistence/src/seller-profiles.js';
import SellerProfileForm from './seller-profile-form';
import OperationsDashboard from './operations-dashboard';
import { openClawCompatibilityMatrix } from '../../../../packages/openclaw-adapter/src/compatibility.js';
import SellerPairing from './seller-pairing';
import SellerPublication from './seller-publication';
import SellerVersionControl from './seller-version-control';

export const dynamic = 'force-dynamic';

export default async function SellerPage() {
  const service = getAuthService();
  const session = await service.auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in?callbackURL=/seller');
  const profile = await getSellerProfile(service.database, session.user.id);
  const acknowledged = profile?.executionModelAcknowledged === true;
  const workers = profile ? await service.database.query<{id:string}>(
    `SELECT id FROM worker_devices WHERE seller_profile_id=$1 AND status<>'REVOKED' LIMIT 1`,
    [profile.id]) : null;
  const paired=Boolean(workers?.rows[0]);
  const showOnboarding = !profile || !acknowledged || profile.status === 'DRAFT';
  return <main className="site-shell">
    <ProductHeader signedIn/>
    {showOnboarding && <section className="seller-layout">
      <div className="seller-heading"><p className="eyebrow"><span className="status-dot" /> Seller workspace</p>
        <h1>Build a useful service.<br /><em>Keep control of the work.</em></h1>
        <p>Kivro runs approved jobs in an isolated workspace on your connected computer. You choose the capabilities and resources you offer. Your machine and any model or provider usage are your operating costs.</p>
      </div>
      <div className="seller-panel"><div className="seller-panel-top"><span className="form-eyebrow">First publication</span><span className="seller-stage">{acknowledged ? 'Profile created' : profile ? 'Confirmation needed' : 'Start here'}</span></div>
        <h2>{profile ? profile.displayName : 'Name your seller workspace'}</h2>
        {acknowledged ? <p className="seller-muted">Your seller profile is a draft. Nothing is listed or available to buyers.</p>
          : <><p className="seller-muted">{profile ? 'Confirm the local execution model before continuing.' : 'This is the public name buyers will see. Your payout identity is handled separately.'}</p><SellerProfileForm defaultName={profile?.displayName ?? session.user.name} existingProfile={Boolean(profile)} /></>}
        <div className="seller-steps" aria-label="Publication steps">
          <div className={acknowledged && !paired ? 'seller-step current' : 'seller-step'}><span>01</span><div><strong>Connect Worker</strong><p>Pair the computer that will run approved jobs.</p>{acknowledged&&!paired&&
            <SellerPairing cloudUrl={process.env.APP_ORIGIN??''}/>}</div><b>{paired?'Paired':acknowledged?'Ready to pair':'Locked'}</b></div>
          <div className="seller-step"><span>02</span><div><strong>Inspect skills on your computer</strong><p>After pairing, run <code>kivro-worker discover</code> on the Worker. It reads OpenClaw metadata locally and marks unknown readiness. Nothing it finds is published or approved automatically.</p></div><b>{paired?'Local review':'Pending'}</b></div>
          <div className="seller-step"><span>03</span><div><strong>Choose a skill and review its dependencies</strong><p>On your paired Worker, run <code>kivro-worker import guided</code> for a single skill with dedicated remote inference. It scans read-only, asks you to select every dependency, creates the private package and runs isolated tests without editing JSON. Other dependency types require the advanced import commands and remain blocked until supported. Selection does not grant runtime access; final consent is still required here.</p></div><b>{paired?'Local draft':'Pending'}</b></div>
          <div className="seller-step"><span>04</span><div><strong>Publish</strong><p>Set price, availability and capacity after all checks pass.</p></div><b>Pending</b></div>
        </div>
        <p className="seller-footnote">Discovery never publishes a skill or grants access. Each permission needs your explicit approval.</p>
      </div>
    </section>}
    {profile && paired && <SellerPublication />}
    {profile && paired && <SellerVersionControl />}
    {profile && (!showOnboarding || paired) && <OperationsDashboard supportedOpenClawVersion={
      openClawCompatibilityMatrix[0].openClawVersion} />}
    <footer className="site-footer"><span>© 2026 Kivro</span><span>Independent work, clear boundaries.</span></footer>
  </main>;
}
