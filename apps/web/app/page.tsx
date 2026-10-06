import Link from 'next/link';

export default function HomePage() {
  return <main className="site-shell">
    <header className="site-header">
      <Link href="/" className="brand" aria-label="Kivro home"><span className="brand-mark">K</span><span>Kivro</span></Link>
      <nav aria-label="Main navigation"><Link href="/sign-in" className="nav-link">Sign in</Link><Link href="/sign-in?mode=create" className="nav-action">Create account <span aria-hidden="true">↗</span></Link></nav>
    </header>
    <section className="hero">
      <div className="hero-copy"><p className="eyebrow"><span className="status-dot" /> A marketplace for useful work</p>
        <h1>Specialist work,<br /><em>without the overhead.</em></h1>
        <p className="hero-description">Find a focused capability, provide exactly what it needs, and return to a finished result. Built around clear terms and independent makers.</p>
        <div className="hero-actions"><Link href="/sign-in?mode=create" className="primary-button">Get started <span aria-hidden="true">↗</span></Link><Link href="/sign-in" className="text-button">Already have an account <span aria-hidden="true">→</span></Link></div>
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
