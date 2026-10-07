'use client';

import { useEffect, useState } from 'react';
import type { InputContract } from '../../../../packages/contracts/src/capability-io.js';

type Permission={dependencyId:string;permissionType:string;permissionValueRef:string;sellerLabel:string};
type Review={reviewId:string;state:'REVIEW'|'PUBLISHED';candidateHash:string;
  policyValidationHash:string;testedAt:string;previousVersionId:string|null;
  previousVersionNumber:number|null;
  changesFromCurrent:string[];
  requiredConsents:Permission[];
  providerCost:{estimatedMicroUsd:number|null;estimateSource:string;
    maxMicroUsdPerJob:number;maxRequestsPerJob:number;maxDailyMicroUsd:number|null};
  candidate:{id:string;capabilityId:string;versionNumber:number;workerManifestHash:string;
    localPackageHash:string;concurrencyLimit:number;runtime:{type:string; supportedVersionRange:string};
    price:{tier:string;currency:string;buyerAmountMinor:number;platformFeeMinor:number;
      sellerEarningMinor:number};ioContract:{input:InputContract;
      output:{fields:{key:string;label:string;required:boolean;type:string}[]}};
    publicPermissionManifest:{entries:{category:string;state:string}[]};
    externalProcessors:string[]|null}};

function money(minor:number):string{return `$${(minor/100).toFixed(2)}`;}
function PreviewInput({field}:{field:InputContract['fields'][number]}){
  if(field.type==='BOOLEAN')return <input type="checkbox" />;
  if(field.type==='SELECT'||field.type==='MULTI_SELECT')return <select multiple={field.type==='MULTI_SELECT'}
    defaultValue={field.type==='MULTI_SELECT'?[]:''}>
    {field.type==='SELECT'&&<option value="">Choose an option</option>}
    {field.constraints.allowedValues.map((value)=><option key={value}>{value}</option>)}
  </select>;
  if(field.type==='LONG_TEXT'||field.type==='MARKDOWN'||field.type==='JSON')
    return <textarea rows={3} />;
  if(field.type==='FILE'||field.type==='FILES')return <input type="file"
    multiple={field.type==='FILES'} accept={field.constraints.allowedExtensions.join(',')} />;
  return <input type={field.type==='NUMBER'||field.type==='INTEGER'?'number':
    field.type==='URL'?'url':'text'} />;
}
function readableError(code:string):string{
  const known:Record<string,string>={NOT_ELIGIBLE:'Seller payout, account or Worker readiness needs attention.',
    STALE_REVIEW:'Worker tests have expired. Run them again before publishing.',
    REVIEW_CHANGED:'The reviewed package changed. Review the latest Worker submission.',
    CONSENT_MISSING:'Review and approve every required permission.',
    PRICE_CHANGED:'The price tier changed. Review a new quote.',
    VERSION_CONFLICT:'A newer version has already been published.',
    CONFLICT:'This publication request conflicts with an earlier approval.'};
  return known[code]??'Publication could not be completed. Your draft remains private.';
}

function PublicationReview({review,onPublished}:{review:Review;onPublished:()=>void}){
  const [slug,setSlug]=useState('');
  const [name,setName]=useState('');
  const [description,setDescription]=useState('');
  const [shortDescription,setShortDescription]=useState('');
  const [category,setCategory]=useState('OTHER');
  const [tags,setTags]=useState('');
  const [strengths,setStrengths]=useState('');
  const [limitations,setLimitations]=useState('');
  const [visibility,setVisibility]=useState<'PRIVATE'|'UNLISTED'|'PUBLIC'>('PRIVATE');
  const [capacity,setCapacity]=useState(1);
  const [queueLimit,setQueueLimit]=useState(0);
  const [futureLimit,setFutureLimit]=useState(0);
  const [maxWaitMinutes,setMaxWaitMinutes]=useState(60);
  const [accepted,setAccepted]=useState<string[]>([]);
  const [costAccepted,setCostAccepted]=useState(false);
  const [localReviewed,setLocalReviewed]=useState(false);
  const [changeAccepted,setChangeAccepted]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const price=review.candidate.price;
  const estimated=review.providerCost.estimatedMicroUsd;
  const estimatedMinor=estimated===null?null:Math.ceil(estimated/10_000);
  const nearLimit=estimatedMinor===null||estimatedMinor>=price.sellerEarningMinor;
  const allAccepted=accepted.length===review.requiredConsents.length;
  const list=(value:string)=>value.split(',').map((part)=>part.trim()).filter(Boolean).slice(0,8);
  const publish=async()=>{
    if(!allAccepted||!costAccepted||!localReviewed||busy||
      (review.previousVersionNumber!==null&&!changeAccepted))return;
    setBusy(true);setMessage('');
    try{
      const response=await fetch('/api/seller/publication/publish',{method:'POST',
        headers:{'content-type':'application/json'},body:JSON.stringify({
          reviewId:review.reviewId,capabilityVersionId:review.candidate.id,
          candidateHash:review.candidateHash,
          manifestHash:review.candidate.workerManifestHash,
          packageHash:review.candidate.localPackageHash,
          policyValidationHash:review.policyValidationHash,
          slug,name,description,category,shortDescription,tags:list(tags),
          strengths:list(strengths),limitations:list(limitations),visibility,
          availability:{schedule:null,concurrencyLimit:capacity,queueLimit,
            futureReservationLimit:futureLimit,estimatedRuntimeSeconds:null,
            maxWaitSeconds:maxWaitMinutes*60},
          consentDependencyIds:accepted,providerCostAcknowledged:true,
          localPermissionReviewAcknowledged:true,
          ...(review.previousVersionNumber!==null?
            {versionChangeAcknowledged:changeAccepted}:{}),
          approvedAt:new Date().toISOString()})});
      if(!response.ok){const body=await response.json() as {code?:string};
        setMessage(readableError(body.code??''));return;}
      onPublished();
    }catch{setMessage('The connection failed. Retry safely with the same reviewed version.');}
    finally{setBusy(false);}
  };
  return <article className="publication-review">
    <div className="publication-review-head"><div><p className="form-eyebrow">Worker review · version {review.candidate.versionNumber}</p>
      <h3>{review.state==='PUBLISHED'?'Published version':'Ready for your review'}</h3></div>
      <span className="status-copy" data-tone={review.state==='PUBLISHED'?'info':'warning'}>
        {review.state==='PUBLISHED'?'Published':'Private draft'}</span></div>
    <p className="seller-muted">The Worker submitted a restricted OpenClaw package and test evidence on {new Date(review.testedAt).toLocaleString()}. Confirm the contract and permissions before listing it. A published capability starts paused until fresh readiness and your resume action.</p>
    {review.state==='REVIEW'&&review.previousVersionNumber!==null&&<section
      className="publication-change-preview" aria-label="Changes from current published version">
      <h4>Changes from live version {review.previousVersionNumber}</h4>
      <p>Review these differences and every permission below before approving this version.</p>
      <ul>{review.changesFromCurrent.map((change)=><li key={change}>{change}</li>)}</ul>
      <label className="publication-change-consent"><input type="checkbox"
        checked={changeAccepted} onChange={(event)=>setChangeAccepted(event.target.checked)} />
        <span>I reviewed the changes from the live version.</span></label>
    </section>}
    <div className="publication-economics" aria-label="Per-job economics">
      <div><span>Buyer price</span><strong>{money(price.buyerAmountMinor)}</strong></div>
      <div><span>Kivro fee</span><strong>{money(price.platformFeeMinor)}</strong></div>
      <div><span>Seller earnings before provider cost</span><strong>{money(price.sellerEarningMinor)}</strong></div>
      <div><span>Estimated provider cost</span><strong>{estimatedMinor===null?'Unknown':`≈ ${money(estimatedMinor)}`}</strong></div>
      <div><span>Estimated net before other costs</span><strong>{estimatedMinor===null?'Unknown':`≈ ${money(price.sellerEarningMinor-estimatedMinor)}`}</strong></div>
    </div>
    <p className={nearLimit?'ops-warning':'seller-muted'}>{estimatedMinor===null
      ? 'Provider cost could not be estimated reliably. The per-job spend ceiling still applies; review your provider pricing before publishing.'
      : nearLimit?'Estimated provider cost meets or exceeds seller earnings. Review the price and limits before publishing.'
        :'Provider cost is an estimate. Actual usage can differ.'} Per-job maximum: {money(Math.ceil(review.providerCost.maxMicroUsdPerJob/10_000))}; {review.providerCost.maxRequestsPerJob} model calls.</p>
    <details className="publication-contract"><summary>Input, output and processing contract</summary>
      <div className="publication-contract-grid"><div><h4>Buyer provides</h4><ul>{review.candidate.ioContract.input.fields.map((field)=><li key={field.key}>{field.label} · {field.type}{field.required?' · required':''}</li>)}</ul></div>
        <div><h4>Buyer receives</h4><ul>{review.candidate.ioContract.output.fields.map((field)=><li key={field.key}>{field.label} · {field.type}{field.required?' · required':''}</li>)}</ul></div></div>
      <p>External processors: {review.candidate.externalProcessors?.join(', ')||'None declared'}.</p>
      <h4>Buyer-visible access summary</h4>
      <ul className="publication-public-access">{review.candidate.publicPermissionManifest.entries.map((entry)=><li key={entry.category}>
        <span>{entry.category.replaceAll('_',' ').toLowerCase()}</span><strong>{entry.state.replaceAll('_',' ').toLowerCase()}</strong>
      </li>)}</ul>
    </details>
    {review.state==='REVIEW'&&<details className="publication-buyer-preview">
      <summary>Preview the buyer view</summary>
      <div className="publication-preview-surface">
        <p className="form-eyebrow">Private preview · version {review.candidate.versionNumber}</p>
        <h4>{name.trim()||'Service name appears here'}</h4>
        <p>{shortDescription.trim()||'Add a short description above to preview the buyer summary.'}</p>
        <p><strong>{money(price.buyerAmountMinor)}</strong> per job · Starts paused until readiness is confirmed</p>
        <fieldset disabled><legend>Buyer provides</legend>
          {review.candidate.ioContract.input.fields.map((field)=><label key={field.key}>
            {field.label}{field.required?' · required':''}
            {field.visibleWhen?` · shown when ${field.visibleWhen.fieldKey} is ${String(field.visibleWhen.equals)}`:''}
            <PreviewInput field={field} />
          </label>)}
        </fieldset>
        <p>Expected result: {review.candidate.ioContract.output.fields.map((field)=>
          `${field.label} (${field.type})`).join(', ')}.</p>
        <p className="seller-muted">This preview does not purchase a job or expose the private draft.</p>
      </div>
    </details>}
    {review.state==='REVIEW'&&<form className="publication-form"
      onSubmit={(event)=>{event.preventDefault();void publish();}}
      onInvalid={(event)=>{
        const field=event.target as HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement;
        field.setAttribute('aria-invalid','true');
        field.setAttribute('aria-describedby','publication-form-error');
        setMessage(`Check ${field.labels?.[0]?.textContent?.trim()||'the highlighted field'} before publishing.`);
      }} onInput={(event)=>{
        const field=event.target as HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement;
        if(field.validity?.valid){field.removeAttribute('aria-invalid');
          field.removeAttribute('aria-describedby');}
      }}>
      <h4>1. Describe the service</h4>
      <div className="publication-fields">
        <label>Public name<input value={name} onChange={(event)=>setName(event.target.value)} maxLength={160} required /></label>
        <label>URL slug<input value={slug} onChange={(event)=>setSlug(event.target.value)} pattern="[a-z0-9-]+" required /></label>
        <label className="publication-wide">Short description<input value={shortDescription} onChange={(event)=>setShortDescription(event.target.value)} minLength={20} maxLength={320} required /></label>
        <label className="publication-wide">What the service does<textarea value={description} onChange={(event)=>setDescription(event.target.value)} minLength={20} maxLength={4000} rows={3} required /></label>
        <label>Category<select value={category} onChange={(event)=>setCategory(event.target.value)}>{['RESEARCH','DATA_ANALYSIS','DOCUMENTS','DEVELOPMENT','MEDIA','BUSINESS','OTHER'].map((item)=><option key={item} value={item}>{item.replaceAll('_',' ')}</option>)}</select></label>
        <label>Visibility<select value={visibility} onChange={(event)=>setVisibility(event.target.value as typeof visibility)}><option value="PRIVATE">Private · invited buyers</option><option value="UNLISTED">Unlisted · link only</option><option value="PUBLIC">Public marketplace</option></select></label>
        <label>Tags, comma separated<input value={tags} onChange={(event)=>setTags(event.target.value)} /></label>
        <label>Strengths, comma separated<input value={strengths} onChange={(event)=>setStrengths(event.target.value)} /></label>
        <label className="publication-wide">Limitations, comma separated<input value={limitations} onChange={(event)=>setLimitations(event.target.value)} /></label>
      </div>
      <h4>2. Availability and capacity</h4>
      <p className="seller-muted">The capability inherits your Worker schedule. It stays paused after publication until you review readiness and resume it.</p>
      <div className="publication-fields">
        <label>Concurrent jobs<input type="number" min={1} max={review.candidate.concurrencyLimit} value={capacity} onChange={(event)=>setCapacity(Number(event.target.value))} required /></label>
        <label>Queue limit<input type="number" min={0} max={64} value={queueLimit} onChange={(event)=>setQueueLimit(Number(event.target.value))} required /></label>
        <label>Future reservations<input type="number" min={0} max={64} value={futureLimit} onChange={(event)=>setFutureLimit(Number(event.target.value))} required /></label>
        <label>Maximum buyer wait, minutes<input type="number" min={1} max={10080} value={maxWaitMinutes} onChange={(event)=>setMaxWaitMinutes(Number(event.target.value))} required /></label>
      </div>
      <h4>3. Approve exact access</h4>
      <p className="seller-muted">Each checked item authorizes one dependency for this Worker, version and manifest only. Discovery and selection did not authorize it.</p>
      <p className="seller-muted">Inspect the full local policy, tool and resource references on your paired Worker before approving. The cloud receives only the reviewed hashes and safe summary.</p>
      <code className="publication-local-command">kivro-worker import permissions {review.candidate.id}{review.previousVersionId?
        ` --against ${review.previousVersionId}`:''}</code>
      <label className="publication-cost-consent"><input type="checkbox" checked={localReviewed}
        onChange={(event)=>setLocalReviewed(event.target.checked)} />
        <span>I reviewed this version’s exact local access and any changes on my Worker.</span></label>
      <div className="publication-consents">{review.requiredConsents.map((item)=><label key={item.dependencyId}>
        <input type="checkbox" checked={accepted.includes(item.dependencyId)} onChange={(event)=>setAccepted((current)=>
          event.target.checked?[...current,item.dependencyId]:current.filter((id)=>id!==item.dependencyId))} />
        <span><strong>{item.sellerLabel}</strong><small>{item.permissionType.replaceAll('_',' ')} · {item.permissionValueRef}</small></span>
      </label>)}</div>
      <label className="publication-cost-consent"><input type="checkbox" checked={costAccepted} onChange={(event)=>setCostAccepted(event.target.checked)} />
        <span>I understand that my provider or local compute costs are mine and that the estimate may be unknown or differ from actual usage.</span></label>
      {message&&<p className="notice error" id="publication-form-error" role="alert">{message}</p>}
      <button className="primary-button" type="submit"
        disabled={busy||!allAccepted||!costAccepted||!localReviewed||
          (review.previousVersionNumber!==null&&!changeAccepted)||
          !name||!slug||!description||!shortDescription}>
        {busy?'Publishing…':'Publish reviewed version'}</button>
    </form>}
  </article>;
}

export default function SellerPublication(){
  const [reviews,setReviews]=useState<Review[]>([]);
  const [state,setState]=useState<'loading'|'ready'|'error'>('loading');
  const reload=async()=>{try{const response=await fetch('/api/seller/publication/reviews',
    {cache:'no-store'});if(!response.ok)throw new Error('REVIEWS_UNAVAILABLE');
    const body=await response.json() as {reviews:Review[]};setReviews(body.reviews);setState('ready');}
    catch{setState('error');}};
  useEffect(()=>{void reload();},[]);
  return <section className="seller-publication" aria-labelledby="publication-heading">
    <div className="publication-heading"><p className="eyebrow">Capability publishing</p>
      <h2 id="publication-heading">Review before buyers can see it.</h2>
      <p>Signed Worker tests create a private review. Only your explicit approval can publish a version.</p></div>
    {state==='loading'&&<p role="status">Loading your Worker reviews…</p>}
    {state==='error'&&<p role="alert" className="notice error">Reviews are unavailable. Retry when the connection returns. <button type="button" onClick={()=>void reload()}>Retry</button></p>}
    {state==='ready'&&reviews.length===0&&<div className="publication-empty"><h3>No reviewed package yet</h3>
      <p>Choose a skill on your paired Worker, review each dependency, configure inference and run the isolated tests. A signed passing review will appear here. Nothing is listed yet.</p></div>}
    {state==='ready'&&reviews.map((review)=><PublicationReview key={review.reviewId} review={review} onPublished={()=>void reload()} />)}
  </section>;
}
