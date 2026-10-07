import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuthService } from '../../src/auth/server.js';
import { MarketplaceHeader } from '../discover/marketplace-ui';
import { AgentPanel } from './agent-panel';

export const dynamic='force-dynamic';
export default async function AIRequestPage({searchParams}:{searchParams:Promise<{
  capabilityId?:string;planId?:string}>}){
  const query=await searchParams;
  const session=await getAuthService().auth.api.getSession({headers:await headers()});
  if(!session)redirect(`/sign-in?callbackURL=${encodeURIComponent('/ai-request')}`);
  return <main className="site-shell market-shell ai-shell">
    <MarketplaceHeader signedIn/>
    <section className="ai-hero"><div><p className="eyebrow">KIVRO MARKETPLACE AGENT</p>
      <h1>Describe the work.<br/><em>Choose who does it.</em></h1>
      <p>Tell us what you need. The agent compares current published services, checks your limits and prepares a plan for your approval. You always authorize spending.</p>
    </div><div className="ai-hero-note"><span>01 / DISCOVER</span><span>02 / REVIEW</span><span>03 / AUTHORIZE</span><p>Marketplace facts and prices come from current Kivro records. Recommendations may be uncertain; each paid job requires a valid quote and reserved credits.</p></div></section>
    <AgentPanel initialCapabilityId={query.capabilityId??null} initialPlanId={query.planId??null}/>
    <footer className="site-footer"><span>© 2026 Kivro</span><span>Buyer approval controls every paid plan.</span></footer>
  </main>;
}
