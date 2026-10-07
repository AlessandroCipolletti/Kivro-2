import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect,notFound } from 'next/navigation';
import { OutputContractSchema } from '../../../../../../packages/contracts/src/capability-io.js';
import { BuyerMarketplaceError } from '../../../../../../packages/persistence/src/marketplace-buyer.js';
import { getAuthService } from '../../../../src/auth/server.js';
import { getMarketplaceService } from '../../../../src/marketplace/server.js';
import { MarketplaceHeader,money,jobStatusLabel } from '../../../discover/marketplace-ui';
import { SafeResult } from '../../../discover/safe-result';
import { JobActions } from './job-actions';
export const dynamic='force-dynamic';
const cancellable=new Set(['PAYMENT_RESERVED','WAITING_FOR_AVAILABILITY','QUEUED',
  'WAITING_FOR_WORKER','DISPATCHED','ACCEPTED']);
export default async function BuyerJobPage({params}:{params:Promise<{id:string}>}){
  const session=await getAuthService().auth.api.getSession({headers:await headers()});
  if(!session)redirect('/sign-in');
  const service=getMarketplaceService();
  const {id}=await params;
  let job:Awaited<ReturnType<ReturnType<typeof service.getBuyer>['job']>>;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))notFound();
  try{job=await service.getBuyer().job(session.user.id,id);}
  catch(error){if(error instanceof BuyerMarketplaceError&&error.code==='NOT_FOUND')notFound();
    throw error;}
  const output=OutputContractSchema.parse(job.outputContract);
  const capability=await service.catalog.detail(job.summary.capabilitySlug,session.user.id);
  const rerunAvailable=capability?.id===job.summary.capabilityId;
  const terminal=['COMPLETED','CANCELLED','EXPIRED','FAILED_EXECUTION','FAILED_POLICY',
    'RESULT_REJECTED','WORKER_OFFLINE','TIMED_OUT','FAILED_STARTUP','REJECTED'].includes(job.summary.status);
  const canReview=job.summary.status==='COMPLETED'&&job.summary.financialState==='SETTLED'&&
    !job.summary.reviewed;
  return <main className="site-shell market-shell"><MarketplaceHeader signedIn/>
    <div className="detail-breadcrumb"><Link href="/buyer">My jobs</Link><span> / </span><strong>{job.summary.capabilityName}</strong></div>
    <section className="job-hero"><div><p className="eyebrow"><span className="status-dot"/> PURCHASED JOB</p><h1>{job.summary.capabilityName}</h1><p>by {job.summary.sellerName} · version {job.summary.versionNumber}</p><span className="job-id">Job {job.summary.id}</span></div><div className="job-hero-status"><small>CURRENT STATE</small><strong>{jobStatusLabel(job.summary.status)}</strong><span>{job.summary.financialState?`Payment: ${job.summary.financialState.replaceAll('_',' ')}`:'Payment state pending'}</span></div></section>
    <div className="job-detail-layout"><article><section className="job-info-panel"><div><small>PURCHASE PRICE</small><strong>{money(job.summary.priceMinor)}</strong></div><div><small>PURCHASED</small><strong>{new Date(job.summary.createdAt).toLocaleString()}</strong></div><div><small>NEXT ELIGIBLE START</small><strong>{job.summary.nextEligibleAt?new Date(job.summary.nextEligibleAt).toLocaleString():'—'}</strong></div><div><small>LATEST START</small><strong>{job.summary.latestStartAt?new Date(job.summary.latestStartAt).toLocaleString():'—'}</strong></div></section>
      {job.input&&<section className="job-content"><h2>Submitted inputs</h2><p>This is the immutable input snapshot for this purchase. File references are private.{job.inputRetainUntil&&` Uploaded inputs are retained until at least ${new Date(job.inputRetainUntil).toLocaleString()}.`}</p><div className="submitted-inputs">{Object.entries(job.input.values).map(([key,value])=><div key={key}><strong>{key}</strong><span>{typeof value==='string'?value:JSON.stringify(value)}</span></div>)}{Object.entries(job.input.assets).map(([key,ids])=><div key={key}><strong>{key}</strong><span>{ids.length} uploaded file{ids.length===1?'':'s'}</span></div>)}</div></section>}
      <section className="job-content"><h2>{job.summary.status==='COMPLETED'?'Your result':'Job status'}</h2>
        {job.summary.status==='COMPLETED'&&job.result?<><p>These deliverables were finalized by Kivro and remain available independently of the seller Worker.</p><div className="deliverables">{output.fields.map((field)=>{
          const value=job.result?.values[field.key];
          const files=job.outputFiles.filter((asset)=>asset.fieldKey===field.key);
          return <div className="deliverable" key={field.key}><div className="deliverable-head"><h3>{field.label}</h3><span>{field.type.replaceAll('_',' ')}</span></div>{field.description&&<p>{field.description}</p>}
            {value!==undefined&&<SafeResult type={field.type} value={value}/>}
            {files.map((file)=><div className="deliverable-file" key={file.id}>{file.mimeType.startsWith('image/')&&<img alt={`${field.label} preview`} src={`/api/marketplace/asset/${file.id}?preview=1`}/>}{file.mimeType.startsWith('video/')&&<video controls preload="metadata" src={`/api/marketplace/asset/${file.id}?preview=1`}/>}{file.mimeType.startsWith('audio/')&&<audio controls preload="metadata" src={`/api/marketplace/asset/${file.id}?preview=1`}/ >}{file.mimeType==='application/pdf'&&<iframe sandbox="" title={`${field.label} PDF preview`} src={`/api/marketplace/asset/${file.id}?preview=1`}/>}<div><strong>{field.label}</strong><span>{file.mimeType} · {(file.sizeBytes/1024).toFixed(1)} KB · retained until {new Date(file.retainUntil).toLocaleString()}</span></div><a href={`/api/marketplace/asset/${file.id}`} download>Download ↓</a></div>)}
            {value===undefined&&files.length===0&&<p className="notice error">This deliverable is not currently available. Report a problem below.</p>}</div>;
        })}</div></>:<p>{terminal?'This job has ended. See the recorded state below.':'The job is durable. You can leave this page and return later; the server continues scheduling and execution.'}</p>}
      </section><section className="job-content"><h2>Recorded milestones</h2><p>Only persisted job states are shown. No percentage or completion time is inferred from these events.</p><ol className="job-timeline"><li><span>Purchased</span><time dateTime={job.summary.createdAt}>{new Date(job.summary.createdAt).toLocaleString()}</time></li>{job.events.map((event,index)=><li key={`${event.status}-${index}`}><span>{jobStatusLabel(event.status)}</span><time dateTime={event.at}>{new Date(event.at).toLocaleString()}</time></li>)}</ol></section>
      {job.problemReports.length>0&&<section className="job-content"><h2>Reported problems</h2>{job.problemReports.map((report,index)=><p key={index}>{report.category.replaceAll('_',' ')} · {new Date(report.createdAt).toLocaleString()}</p>)}</section>}
    </article><aside><div className="job-side-panel"><p className="form-eyebrow">THIS PURCHASE</p><h2>{money(job.summary.priceMinor)}</h2><p>The price, version and permissions for this job are immutable. A new run uses today’s published terms.</p>{rerunAvailable&&<><Link href={`/capabilities/${job.summary.capabilitySlug}?again=${job.summary.id}#run-title`} className="primary-button">Run again</Link><Link href={`/capabilities/${job.summary.capabilitySlug}?again=${job.summary.id}#run-title`} className="job-secondary-link">Duplicate & edit</Link></>}{!rerunAvailable&&<p>New purchases of this capability are currently unavailable.</p>}</div><JobActions jobId={job.summary.id} canCancel={cancellable.has(job.summary.status)} canReview={canReview}/></aside></div>
    <footer className="site-footer"><span>© 2026 Kivro</span><span>Private result access is checked on every request.</span></footer></main>;
}
