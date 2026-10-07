import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuthService } from '../../src/auth/server.js';
import { getMarketplaceService } from '../../src/marketplace/server.js';
import { MarketplaceHeader,Card,EmptyMarket,money,jobStatusLabel } from '../discover/marketplace-ui';
import { CreditPanel } from './credit-panel';
export const dynamic='force-dynamic';
export default async function BuyerPage({searchParams}:{searchParams:Promise<{view?:string;page?:string}>}){
  const session=await getAuthService().auth.api.getSession({headers:await headers()});
  if(!session)redirect('/sign-in');
  const query=await searchParams;
  const view=query.view;
  const page=Math.max(1,Math.min(12_500,Number.parseInt(query.page??'1',10)||1));
  const service=getMarketplaceService();
  const buyerId=session.user.id;
  const [jobs,totalJobs,balances,liked,totalFavorites,recent,purchases]=await Promise.all([
    service.getBuyer().history(buyerId,80,null,(page-1)*80),
    service.getBuyer().historyCount(buyerId),service.finance.buyerBalance(buyerId),
    service.social.favorites(buyerId,80,view==='favorites'?(page-1)*80:0),
    service.social.favoritesCount(buyerId),service.getBuyer().recentlyUsed(buyerId),
    service.getBuyer().creditPurchases(buyerId)]);
  const [favorites,recentCards]=await Promise.all([
    service.catalog.listedCards(liked,buyerId),service.catalog.listedCards(recent,buyerId)]);
  const groups={active:jobs.filter((job)=>!['COMPLETED','CANCELLED','EXPIRED','FAILED_STARTUP',
    'FAILED_EXECUTION','FAILED_POLICY','TIMED_OUT','WORKER_OFFLINE','RESULT_REJECTED','REJECTED'].includes(job.status)),
  finished:jobs.filter((job)=>job.status==='COMPLETED'),
  others:jobs.filter((job)=>!['COMPLETED','PAYMENT_RESERVED','WAITING_FOR_AVAILABILITY','QUEUED',
    'WAITING_FOR_WORKER','DISPATCHED','ACCEPTED','STARTING','RUNNING','UPLOADING_RESULT',
    'PAUSE_REQUESTED','PAUSED','RESUME_REQUESTED','SECURITY_PAUSED','CANCEL_REQUESTED'].includes(job.status))};
  return <main className="site-shell market-shell"><MarketplaceHeader signedIn/>
    <section className="buyer-hero"><div><p className="eyebrow"><span className="status-dot"/> Buyer workspace</p><h1>Your work, <em>all in one place.</em></h1><p>Track every purchase, return to a finished result, and start again with current terms.</p></div><div className="buyer-balance"><span>KIVRO CREDITS</span><strong>{money(balances.availableMinor)}</strong><small>Available · {money(balances.reservedMinor)} reserved</small></div></section>
    <nav className="buyer-tabs" aria-label="Buyer views"><Link className={!view?'selected':''} href="/buyer">My jobs</Link><Link className={view==='favorites'?'selected':''} href="/buyer?view=favorites">Favorites</Link><Link className={view==='recent'?'selected':''} href="/buyer?view=recent">Recently used</Link><Link className={view==='credits'?'selected':''} href="/buyer?view=credits">Credits</Link></nav>
    {view==='favorites'?<section className="buyer-section"><h2>Favorites</h2>{favorites.length?<div className="market-grid">{favorites.map((item)=><Card key={item.id} item={item}/>)}</div>:<EmptyMarket title="No favorites yet" description="Save a capability from its detail page to find it here."/>}<nav className="buyer-history-pages" aria-label="Favorite pages">{page>1&&<Link href={`/buyer?view=favorites&page=${page-1}`}>Newer favorites</Link>}<span>Page {page} · {totalFavorites} favorites</span>{page*80<totalFavorites&&<Link href={`/buyer?view=favorites&page=${page+1}`}>Older favorites</Link>}</nav></section>:
      view==='recent'?<section className="buyer-section"><h2>Recently used</h2>{recentCards.length?<div className="market-grid">{recentCards.map((item)=><Card key={item.id} item={item}/>)}</div>:<EmptyMarket title="No recent capabilities" description="Capabilities you purchase will appear here."/>}</section>:
      view==='credits'?<CreditPanel balance={balances.availableMinor} purchases={purchases}/>:
      <div className="buyer-job-sections"><JobGroup title="In progress & waiting" jobs={groups.active}/><JobGroup title="Completed" jobs={groups.finished}/><JobGroup title="Failed, expired & cancelled" jobs={groups.others}/><nav className="buyer-history-pages" aria-label="Job history pages">{page>1&&<Link href={`/buyer?page=${page-1}`}>Newer jobs</Link>}<span>Page {page} · {totalJobs} total jobs</span>{page*80<totalJobs&&<Link href={`/buyer?page=${page+1}`}>Older jobs</Link>}</nav></div>}
    <footer className="site-footer"><span>© 2026 Kivro</span><span>Jobs stay available after you close the browser.</span></footer></main>;
}
function JobGroup({title,jobs}:{title:string;jobs:readonly {id:string;status:string;capabilityName:string;
  sellerName:string;createdAt:string;priceMinor:number;nextEligibleAt:string|null}[]}){
  const empty=title==='Completed'?'Completed results and files will appear here.':
    title==='In progress & waiting'?'Purchased jobs appear here while they wait or run.':
      'No failed, expired or cancelled jobs.';
  return <section className="buyer-section"><div className="buyer-section-head"><h2>{title}</h2><span>{jobs.length}</span></div>{jobs.length?<div className="job-list">{jobs.map((job)=><Link key={job.id} href={`/buyer/jobs/${job.id}`} className="job-row"><div><strong>{job.capabilityName}</strong><span>by {job.sellerName} · purchased {new Date(job.createdAt).toLocaleString()}</span></div><div><span className="job-state">{jobStatusLabel(job.status)}</span>{job.nextEligibleAt&&<small>Next eligible {new Date(job.nextEligibleAt).toLocaleString()}</small>}</div><strong>{money(job.priceMinor)}</strong></Link>)}</div>:<p className="buyer-empty-row">{empty}</p>}</section>;
}
