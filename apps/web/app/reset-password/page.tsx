import { ProductHeader } from '../ui/product-header';
import ResetPanel from './reset-panel';

export default function ResetPasswordPage() {
  return <main className="site-shell"><ProductHeader mode="auth"/>
    <section className="auth-layout"><div className="auth-intro"><p className="eyebrow"><span className="status-dot" /> Account recovery</p><h1>Back to<br /><em>your work.</em></h1><p>Reset your password securely. A recovery link expires and can be used only once.</p></div><ResetPanel /></section>
    <footer className="site-footer"><span>© 2026 Kivro</span><span>Work with clear boundaries.</span></footer>
  </main>;
}
