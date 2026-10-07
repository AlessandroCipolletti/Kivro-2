import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getAuthService } from '../../../src/auth/server.js';
import { getMarketplaceService } from '../../../src/marketplace/server.js';
import { BuyerMarketplaceError } from '../../../../../packages/persistence/src/marketplace-buyer.js';
import { MarketplaceHeader,money,availabilityLabel } from '../../discover/marketplace-ui';
import { SafeResult } from '../../discover/safe-result';
import { RunForm } from './run-form';
import { MarketplaceAgentRepository } from '../../../../../packages/persistence/src/marketplace-agent.js';

export const dynamic='force-dynamic';
export default async function CapabilityPage({params,searchParams}:{params:Promise<{slug:string}>;
  searchParams:Promise<{again?:string;template?:string;agentDraft?:string}>}){
  const {slug}=await params;const query=await searchParams;
  const session=await getAuthService().auth.api.getSession({headers:await headers()});
  const service=getMarketplaceService();
  const detail=await service.catalog.detail(slug,session?.user.id??null);
  if(!detail)notFound();
  const termsAccepted=session?await service.getBuyer().termsStatus(session.user.id):false;
  let initialValues:Record<string,unknown>={};let initialAssets:Record<string,string[]>={};
  let sourceLabel:string|undefined;
  let changeWarning:string|undefined;
  if(query.agentDraft&&session&&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query.agentDraft)){
    const draft=await new MarketplaceAgentRepository(service.pool).draft(
      session.user.id,query.agentDraft);
    if(draft?.capabilityId===detail.id){
      if(draft.capabilityVersionId===detail.version.id){
        initialValues=draft.values;initialAssets=draft.assets;
        sourceLabel='Prepared with Marketplace Agent';
      }else changeWarning='This service has a new published version. Prepare fresh inputs and review the current price and permissions.';
    }
  }else if(query.again&&session&&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query.again)){
    try{const prior=await service.getBuyer().job(session.user.id,query.again);
      if(prior.summary.capabilityId===detail.id&&prior.input){
        initialValues=prior.input.values;sourceLabel='Prefilled from your previous job';
        if(prior.summary.versionId!==detail.version.id){
          changeWarning=JSON.stringify(prior.permissionManifest)===
            JSON.stringify(detail.version.permissionManifest)?
              'The published version changed since your previous job. Check the current inputs and price.':
              'Declared permissions changed since your previous job. Review Privacy & access, the current inputs and price before purchase.';
        }
      }}catch(error){
        if(!(error instanceof BuyerMarketplaceError&&error.code==='NOT_FOUND'))throw error;
        // Unknown prior job cannot disclose any input.
      }
  }else if(query.template){
    const example=detail.examples.find((item)=>item.id===query.template);
    if(example){initialValues=example.inputValues;sourceLabel='Prefilled from a seller-approved example';}
  }
  const runtime=detail.typicalRuntimeSeconds===null?'Not enough completed jobs to estimate runtime':
    `Typical run: about ${Math.max(1,Math.round(detail.typicalRuntimeSeconds/60))} minutes`;
  return <main className="site-shell market-shell"><MarketplaceHeader signedIn={!!session}/>
    <div className="detail-breadcrumb"><Link href="/discover">Discover</Link><span> / </span><span>{detail.category.replaceAll('_',' ')}</span><span> / </span><strong>{detail.name}</strong><Link href={`/ai-request?capabilityId=${detail.id}`} style={{marginLeft:'auto'}}>Ask Marketplace Agent ↗</Link></div>
    <div className="detail-layout"><article className="detail-main"><div className="detail-kicker"><span className="market-category">{detail.category.replaceAll('_',' ')}</span><span className={`availability-pill ${detail.availability.status==='ONLINE'?'is-online':''}`}><i/>{availabilityLabel(detail.availability.status,detail.availability.acceptingQueue)}</span></div>
      <h1>{detail.name}</h1><p className="detail-lead">{detail.shortDescription}</p>
      <div className="detail-proof"><span>{detail.rating.average===null?'New capability':`${detail.rating.average.toFixed(1)} ★ · ${detail.rating.count} verified reviews`}</span><span>{detail.completedJobs} completed jobs</span><span>{runtime}</span></div>
      <section className="detail-section"><h2>What this does</h2><p className="detail-body">{detail.description}</p>{detail.strengths.length>0&&<><h3>Works well for</h3><ul>{detail.strengths.map((item)=><li key={item}>{item}</li>)}</ul></>}{detail.limitations.length>0&&<><h3>Limits to know</h3><ul>{detail.limitations.map((item)=><li key={item}>{item}</li>)}</ul></>}</section>
      <section className="detail-section"><h2>Inputs & deliverables</h2><div className="detail-contract"><div><h3>You provide</h3>{detail.version.ioContract.input.fields.map((field)=><p key={field.key}><strong>{field.label}</strong><span>{field.type.replaceAll('_',' ')}{field.required?' · required':''}{(field.type==='FILE'||field.type==='FILES')&&<> · {field.constraints.allowedExtensions.join(', ')} · max {(field.constraints.maxFileSizeBytes/1024/1024).toFixed(1)} MB each</>}</span></p>)}</div><div><h3>You receive</h3>{detail.version.ioContract.output.fields.map((field)=><p key={field.key}><strong>{field.label}</strong><span>{field.type.replaceAll('_',' ')}{field.required?' · required':''}{(field.type==='FILE'||field.type==='FILES')&&<> · {field.constraints.allowedExtensions.join(', ')}</>}</span></p>)}</div></div></section>
        <section className="detail-section"><h2>Examples</h2><p className="detail-section-note">Representative outputs depend on the submitted inputs. Every public example is seller approved for this version.</p>{detail.examples.length?<div className="example-list">{detail.examples.map((example)=><div className="example-card" key={example.id}><h3>{example.title}</h3><p>{example.description}</p><div className="example-pair"><div><small>INPUT</small>{Object.entries(example.inputValues).map(([key,value])=><p key={key}><strong>{detail.version.ioContract.input.fields.find((field)=>field.key===key)?.label??key}:</strong> {typeof value==='string'?value:JSON.stringify(value)}</p>)}{example.inputAssets.map((asset)=><p key={asset.assetId}><strong>{detail.version.ioContract.input.fields.find((field)=>field.key===asset.fieldKey)?.label??asset.fieldKey}:</strong> {asset.mimeType} · {(asset.sizeBytes/1024).toFixed(1)} KB <a href={`/api/marketplace/example-asset/${asset.assetId}`}>Download example input</a></p>)}</div><div><small>RESULT</small>{Object.entries(example.outputValues).map(([key,value])=><div key={key}><strong>{detail.version.ioContract.output.fields.find((field)=>field.key===key)?.label??key}</strong><SafeResult type={detail.version.ioContract.output.fields.find((field)=>field.key===key)?.type??'LONG_TEXT'} value={value}/></div>)}{example.outputAssets.map((asset)=><div key={asset.assetId} className="example-media">{asset.mimeType.startsWith('image/')&&<img alt={`${asset.fieldKey} example`} src={`/api/marketplace/example-asset/${asset.assetId}?preview=1`}/>}{asset.mimeType.startsWith('video/')&&<video controls preload="metadata" src={`/api/marketplace/example-asset/${asset.assetId}?preview=1`}/>}{asset.mimeType.startsWith('audio/')&&<audio controls preload="metadata" src={`/api/marketplace/example-asset/${asset.assetId}?preview=1`}/ >}{asset.mimeType==='application/pdf'&&<iframe sandbox="" title={`${asset.fieldKey} PDF preview`} src={`/api/marketplace/example-asset/${asset.assetId}?preview=1`}/>}<a href={`/api/marketplace/example-asset/${asset.assetId}`}>Download {asset.fieldKey} · {asset.mimeType}</a></div>)}</div></div><Link href={`/capabilities/${slug}?template=${example.id}#run-title`}>Use as template →</Link></div>)}</div>:<p className="detail-empty-inline">No seller-approved examples for this version yet.</p>}</section>
      <section className="detail-section"><h2>Privacy & access</h2><p className="detail-section-note">Your inputs are processed on the seller’s machine inside a temporary per-job sandbox. Review the declared access before uploading sensitive information. Kivro does not claim confidential computing. Discovery of a resource never grants access; this version declares only the access shown below.</p><div className="permission-grid">{detail.version.permissionManifest.entries.map((entry)=><div key={entry.category}><span>{entry.category.replaceAll('_',' ')}</span><strong>{entry.state.replaceAll('_',' ')}</strong></div>)}</div><p className="detail-section-note">Public research access: {detail.version.researchAccess?'declared for this version':'not declared'}. The job cannot browse the seller’s private network. Buyer files are private and shared only with the authorized job. Uploaded inputs start with seven-day retention; an accepted scheduled job can extend retention to cover its deadline. The earliest current file-retention deadline appears in My Jobs.</p></section>
      <section className="detail-section"><h2>Reviews</h2><p className="detail-section-note">Only buyers with completed paid jobs may review. One review per job.</p>{detail.reviews.length?<div className="review-list">{detail.reviews.map((review)=><div className="review-card" key={review.id}><strong>{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</strong><time dateTime={review.createdAt}>{new Date(review.createdAt).toLocaleDateString()}</time><p>{review.text}</p></div>)}</div>:<p className="detail-empty-inline">No verified reviews yet.</p>}</section>
    </article><aside className="detail-aside"><div className="detail-purchase-card"><span className="form-eyebrow">CURRENT PUBLISHED VERSION · {detail.version.number}</span><strong className="detail-price">{money(detail.price.buyerAmountMinor)}</strong><p>One fixed price. Credits are reserved before execution and settled only after validated output.</p><div className="detail-availability"><strong>{availabilityLabel(detail.availability.status,detail.availability.acceptingQueue)}</strong>{detail.availability.nextAvailableAt&&<span>Next available: {new Date(detail.availability.nextAvailableAt).toLocaleString()}</span>}{!detail.availability.acceptingImmediate&&!detail.availability.acceptingQueue&&!detail.availability.canSchedule&&<span>New purchases may be unavailable until seller readiness returns.</span>}</div>{detail.availability.acceptingImmediate||detail.availability.acceptingQueue||detail.availability.canSchedule?<a href="#run-title" className="primary-button">{detail.availability.status==='SCHEDULED_OFFLINE'?'Schedule a job →':'Prepare a job →'}</a>:<span className="primary-button disabled" aria-disabled="true">Not accepting new jobs</span>}<small>Preflight checks the current terms before you confirm.</small></div><div className="detail-seller-card"><span>INDEPENDENT SELLER</span><Link href={`/sellers/${detail.sellerId}`}>{detail.sellerName} ↗</Link><p>Member since {new Date(detail.sellerMemberSince).toLocaleDateString()}.</p></div></aside></div>
    <section className="detail-run">{session?<RunForm key={`${detail.version.id}:${query.agentDraft??query.again??query.template??'new'}`} detail={detail} initialValues={initialValues} initialAssets={initialAssets} termsAccepted={termsAccepted} {...(sourceLabel?{sourceLabel}:{})} {...(changeWarning?{changeWarning}:{})}/>:<div className="run-panel"><h2 id="run-title">Ready to get started?</h2><p>Sign in to prepare inputs, check live availability and purchase with Kivro Credits.</p><Link href={`/sign-in?callbackURL=${encodeURIComponent(`/capabilities/${slug}`)}`} className="primary-button">Sign in →</Link></div>}</section>
    <section className="detail-terms"><div><h3>Cancellation & refunds</h3><p>Eligible cancellation before execution releases reserved credits. If execution fails, the payment state is reconciled by Kivro; Worker messages cannot settle earnings.</p></div><div><h3>Durable results</h3><p>Your job stays in My Jobs after you close this page. Completed files are private and available until their displayed retention date.</p></div></section>
    <footer className="site-footer"><span>© 2026 Kivro</span><span>Current terms are checked again before purchase.</span></footer></main>;
}
