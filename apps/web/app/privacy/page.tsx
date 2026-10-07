import Link from 'next/link';
import { MarketplaceHeader } from '../discover/marketplace-ui';

/** Product data-flow notice; provider-specific retention terms are not guessed here. */
export default function PrivacyPage(){return <main className="site-shell market-shell">
  <MarketplaceHeader/>
  <article className="terms-page"><p className="eyebrow">KIVRO PRIVACY NOTICE</p>
    <h1>Know where your request goes.</h1>
    <p>Kivro uses your account to keep your marketplace conversations, plans, jobs, inputs and results private to you. A paid capability receives only the inputs and scoped files authorized for that job under its published access rules.</p>
    <h2>Seller machine execution</h2>
    <p>Paid jobs run in an isolated Worker on an independent seller’s machine. That Worker can process the fields and files you approve for the job. Kivro cannot promise that the seller’s hardware is confidential computing. Review each capability’s access and external processor declaration before purchase; model providers or other declared services may receive job data when the capability needs them.</p>
    <p>Uploaded files and generated results are stored temporarily in private Kivro object storage. My Jobs displays each result’s retention deadline. A scheduled job can extend input-file retention to cover its accepted execution window. Kivro does not automatically visit URLs returned in results.</p>
    <h2>Marketplace Agent</h2>
    <p>When you use AI Request, Kivro may send your request text, the limits you set, and the minimum public capability information needed for that task to Kivro’s configured third-party platform AI provider, OpenAI or Anthropic. The provider may change according to Kivro’s server-side configuration. Do not put secrets in an AI Request.</p>
    <p>Marketplace Agent uses buyer-owned file metadata only when you select a file for input preparation. It does not send your private file bytes to the platform AI provider. Selected file bytes are made available only to the paid capability job you authorize, according to the published contract and scoped storage grants.</p>
    <h2>Records and payments</h2>
    <p>Kivro records visible Agent messages, plans and provider usage metadata to operate the service and account for platform AI cost. Hidden model reasoning is not stored. Paid jobs use a separate Kivro Credits ledger; the seller Worker does not receive platform AI credentials or decide financial outcomes.</p>
    <p>Review a capability’s privacy and access information before approval. <Link href="/marketplace-terms">Read marketplace use terms</Link></p>
    <Link href="/ai-request" className="primary-button">Return to AI Request</Link>
  </article>
  <footer className="site-footer"><span>© 2026 Kivro</span><span>Privacy notice</span></footer>
</main>}
