import { ProductHeader } from '../ui/product-header';
import AuthPanel from './auth-panel';

export const dynamic = 'force-dynamic';

export default function SignInPage() {
  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  return <main className="site-shell">
    <ProductHeader mode="auth"/>
    <section className="auth-layout">
      <div className="auth-intro"><p className="eyebrow"><span className="status-dot" /> Your account</p><h1>A place for<br /><em>work that matters.</em></h1><p>Find focused capabilities, follow work on your schedule, and keep every result in one place.</p>
        <div className="auth-proof"><div><strong>Clear scope</strong><span>Know what a capability needs before you begin.</span></div><div><strong>Your pace</strong><span>Leave the page and return when work is done.</span></div></div>
      </div>
      <AuthPanel googleEnabled={googleEnabled} />
    </section>
    <footer className="site-footer"><span>© 2026 Kivro</span><span>Work with clear boundaries.</span></footer>
  </main>;
}
