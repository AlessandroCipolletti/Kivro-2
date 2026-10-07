import Link from 'next/link';
import { ProductHeader } from './ui/product-header';

export default function HomePage() {
  return <main className="site-shell">
    <ProductHeader/>
    <section className="hero">
      <div className="hero-copy"><p className="eyebrow"><span className="status-dot" /> A marketplace for useful work</p>
        <h1>Specialist work,<br /><em>without the overhead.</em></h1>
        <p className="hero-description">Find a focused capability, provide exactly what it needs, and return to a finished result. Built around clear terms and independent makers.</p>
        <div className="hero-actions"><Link href="/discover" className="primary-button">Explore capabilities</Link><Link href="/sign-in?mode=create" className="text-button">Create an account</Link></div>
      </div>
      <div className="hero-aside" aria-label="How Kivro works"><span className="aside-label">The process</span>
        <div className="process-step"><span>01</span><div><strong>Choose a capability</strong><p>Know the scope and price before you start.</p></div></div>
        <div className="process-step"><span>02</span><div><strong>Provide your inputs</strong><p>Only the approved information is used.</p></div></div>
        <div className="process-step"><span>03</span><div><strong>Collect the result</strong><p>Close the browser and come back when it is ready.</p></div></div>
        <div className="aside-foot">Built for buyers and independent sellers.</div>
      </div>
    </section>
    <footer className="site-footer"><span>© 2026 Kivro</span><span>Work with clear boundaries.</span></footer>
  </main>;
}
