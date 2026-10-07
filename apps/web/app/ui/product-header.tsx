import Link from 'next/link';
import { Icon } from './kivro-icon';

export function ProductHeader({signedIn=false,mode='marketplace'}:{
  signedIn?:boolean;mode?:'marketplace'|'account'|'auth';
}){
  const links = signedIn ? [
    {href:'/discover',label:'Discover'},
    {href:'/ai-request',label:'AI Request'},
    {href:'/buyer',label:'My jobs'},
    {href:'/buyer?view=favorites',label:'Favorites'},
    {href:'/seller',label:'Seller workspace'},
    {href:'/account',label:'Account'},
  ] : [
    {href:'/discover',label:'Discover'},
    {href:'/discover#categories',label:'Categories'},
    {href:'/ai-request',label:'AI Request'},
    {href:'/sign-in',label:'Sign in'},
    {href:'/sign-in?mode=create',label:'Create account'},
  ];
  const desktop = mode==='auth' ? links.filter((item)=>item.href==='/discover'||item.href==='/sign-in?mode=create') :
    mode==='account' ? links.filter((item)=>item.href==='/discover'||item.href==='/buyer'||item.href==='/seller') :
    signedIn ? links.filter((item)=>item.href!=='/buyer?view=favorites') : links.filter((item)=>item.href!=='/sign-in?mode=create');
  return <header className="site-header market-header">
    <Link href="/" className="brand" aria-label="Kivro home"><span className="brand-mark">K</span><span>Kivro</span></Link>
    <nav className="desktop-nav" aria-label="Primary navigation">
      {desktop.map((item)=><Link key={item.href} href={item.href}
        className={item.href==='/account'||item.href==='/sign-in'?'nav-action':undefined}>{item.label}</Link>)}
    </nav>
    <details className="mobile-nav"><summary><Icon name="menu"/> Menu</summary>
      <nav aria-label="Mobile navigation">{links.map((item)=><Link key={item.href} href={item.href}>{item.label}</Link>)}</nav>
    </details>
  </header>;
}
