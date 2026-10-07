import Link from 'next/link';
import type { CapabilityCard } from '../../../../packages/contracts/src/marketplace.js';

export function money(minor:number){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(minor/100);}
export function availabilityLabel(status:string,acceptingQueue=false){return ({ONLINE:'Available now',BUSY:acceptingQueue?'Busy · queue open':'Busy',
  SCHEDULED_OFFLINE:'Scheduled offline',OFFLINE:'Worker offline',PAUSED:'Paused',
  READINESS_BLOCKED:'Temporarily unavailable',UNAVAILABLE:'Unavailable'} as Record<string,string>)[status]??'Unavailable';}
export function jobStatusLabel(status:string){return ({PAYMENT_RESERVED:'Payment reserved',
  WAITING_FOR_AVAILABILITY:'Waiting for schedule',QUEUED:'In queue',
  WAITING_FOR_WORKER:'Waiting for provider',DISPATCHED:'Offered to provider',
  ACCEPTED:'Accepted by provider',STARTING:'Starting',RUNNING:'Running',
  PAUSE_REQUESTED:'Pausing by provider',PAUSED:'Paused by provider',
  RESUME_REQUESTED:'Resuming by provider',SECURITY_PAUSED:'Temporarily unavailable',
  CANCEL_REQUESTED:'Cancellation requested',UPLOADING_RESULT:'Finalizing result',
  COMPLETED:'Completed',CANCELLED:'Cancelled',EXPIRED:'Expired',
  FAILED_EXECUTION:'Execution failed',FAILED_POLICY:'Blocked by policy',
  RESULT_REJECTED:'Result rejected',WORKER_OFFLINE:'Provider offline',
  TIMED_OUT:'Timed out',FAILED_STARTUP:'Could not start',REJECTED:'Not accepted'} as
    Record<string,string>)[status]??'Updating';}
export function MarketplaceHeader({signedIn=false}:{signedIn?:boolean}){
  return <header className="site-header market-header"><Link href="/" className="brand" aria-label="Kivro home"><span className="brand-mark">K</span><span>Kivro</span></Link>
    <nav aria-label="Marketplace navigation"><Link href="/discover">Discover</Link><Link href="/discover#categories">Categories</Link>
      {signedIn?<><Link href="/buyer?view=favorites">Favorites</Link><Link href="/buyer">My jobs</Link><Link href="/seller">Selling</Link><Link className="nav-action" href="/account">Account ↗</Link></>:<Link className="nav-action" href="/sign-in">Sign in ↗</Link>}</nav></header>;
}
export function Card({item}:{item:CapabilityCard}){
  const runtime=item.typicalRuntimeSeconds===null?'Runtime not established':
    item.typicalRuntimeSeconds<60?'Usually under 1 min':`Typically ${Math.round(item.typicalRuntimeSeconds/60)} min`;
  return <Link href={`/capabilities/${item.slug}`} className="market-card">
    <div className="market-card-top"><span className="market-category">{item.category.replaceAll('_',' ')}</span><span className={`availability-pill ${item.availability.status==='ONLINE'?'is-online':''}`}><i />{availabilityLabel(item.availability.status,item.availability.acceptingQueue)}</span></div>
    <h3>{item.name}</h3><p className="market-card-description">{item.shortDescription}</p>
    <p className="market-card-seller">by {item.sellerName}</p>
    <div className="market-card-tags"><span>Input: {item.inputTypes.slice(0,2).join(' + ')}</span><span>Output: {item.outputTypes.slice(0,2).join(' + ')}</span></div>
    <div className="market-card-bottom"><div><strong>{money(item.price.buyerAmountMinor)}</strong><span>fixed price</span></div>
      <div className="market-card-proof"><strong>{item.rating.average===null?'New':`${item.rating.average.toFixed(1)} ★`}</strong><span>{item.rating.count?`${item.rating.count} verified reviews`:'No reviews yet'}</span></div></div>
    <div className="market-runtime">{runtime}{item.completedJobs?` · ${item.completedJobs} completed jobs`:''}</div>
  </Link>;
}
export function EmptyMarket({title,description}:{title:string;description:string}){
  return <div className="market-empty"><span aria-hidden="true">◌</span><h2>{title}</h2><p>{description}</p></div>;
}
