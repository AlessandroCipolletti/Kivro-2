'use client';
import { Fragment,useRef,useState } from 'react';
import { sha256 } from '@noble/hashes/sha2.js';
import type { CapabilityDetail } from '../../../../../packages/contracts/src/marketplace.js';
import type { ScheduleQuote } from '../../../../../packages/contracts/src/availability.js';
import { money,availabilityLabel } from '../../discover/marketplace-ui';
import { Icon } from '../../ui/kivro-icon';

type Values=Record<string,unknown>;
type Assets=Record<string,string[]>;
type QuoteResponse={quote:ScheduleQuote;balance:{availableMinor:number;reservedMinor:number};canAfford:boolean};
async function post<T>(path:string,body:unknown):Promise<T>{
  const response=await fetch(`/api/marketplace/${path}`,{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify(body),credentials:'same-origin'});
  const value=await response.json() as T&{code?:string};
  if(!response.ok)throw new Error(value.code??'REQUEST_FAILED');
  return value;
}
function initial(detail:CapabilityDetail,values:Values):Values{
  return Object.fromEntries(detail.version.ioContract.input.fields.flatMap((field)=>{
    const value=values[field.key]??('defaultValue' in field?field.defaultValue:undefined);
    return value===undefined?[]:[[field.key,value]];
  }));
}
function friendlyError(value:string):string{
  const messages:Record<string,string>={NOT_READY:'This capability is not ready to accept a job. Please try later.',
    STALE_QUOTE:'Price or availability changed. Check the current terms again.',
    SCHEDULED_OFFLINE:'The current schedule is closed. Select the earliest eligible window.',
    NO_FUTURE_WINDOW:'No eligible start fits your latest acceptable time.',
    CAPACITY_FULL:'This capability has reached its current capacity.',
    QUEUE_FULL:'The queue is full. Please try later.',
    NOT_ELIGIBLE:'This capability cannot accept your job right now.',
    CONFLICT:'The capability terms or inputs changed. Refresh and check again.',
    INVALID_INPUT:'Review the required inputs and uploaded files.',
    MISSING_OBJECT:'The uploaded file did not reach private storage. Try uploading it again.',
    SIZE_MISMATCH:'The uploaded file size changed. Select the file again.',
    HASH_MISMATCH:'The uploaded file failed integrity validation. Select the file again.',
    UNSUPPORTED_TYPE:'The file contents do not match this capability’s allowed formats.',
    LIMIT_EXCEEDED:'The uploaded file exceeds this capability’s limits.',
    STRIPE_NOT_READY:'Payment provider status is not ready; your credits were not reserved.'};
  return messages[value]??value;
}
export function RunForm({detail,initialValues={},initialAssets={},sourceLabel,changeWarning,termsAccepted}:{detail:CapabilityDetail;
  initialValues?:Values;initialAssets?:Assets;sourceLabel?:string;changeWarning?:string;termsAccepted:boolean}){
  const [values,setValues]=useState<Values>(()=>initial(detail,initialValues));
  const [rawJson,setRawJson]=useState<Record<string,string>>(()=>Object.fromEntries(
    detail.version.ioContract.input.fields.filter((field)=>field.type==='JSON').map((field)=>[
      field.key,initialValues[field.key]===undefined?'':JSON.stringify(initialValues[field.key],null,2)])));
  const [files,setFiles]=useState<Record<string,File[]>>({});
  const [ownedAssets,setOwnedAssets]=useState<Assets>(initialAssets);
  const [mode,setMode]=useState<'IMMEDIATE_ONLY'|'EARLIEST_AVAILABLE'>(
    detail.availability.status==='SCHEDULED_OFFLINE'&&detail.availability.canSchedule?
      'EARLIEST_AVAILABLE':'IMMEDIATE_ONLY');
  const [deadline,setDeadline]=useState('');
  const [quote,setQuote]=useState<QuoteResponse|null>(null);
  const [payload,setPayload]=useState<{values:Values;assets:Assets}|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [fieldError,setFieldError]=useState<{key:string;message:string}|null>(null);
  const [favorite,setFavorite]=useState(detail.favorite);
  const [acceptedTerms,setAcceptedTerms]=useState(termsAccepted);
  const canRequest=detail.availability.acceptingImmediate||
    detail.availability.acceptingQueue||detail.availability.canSchedule;
  const purchaseAttempt=useRef<{quoteId:string;jobId:string;reservationId:string;
    manifestId:string}|null>(null);
  const update=(key:string,value:unknown)=>{setValues((old)=>({...old,[key]:value}));setQuote(null);
    setFieldError((old)=>old?.key===key?null:old);};
  const inputFields=[...detail.version.ioContract.input.fields].sort((a,b)=>a.order-b.order);
  const current=inputFields.filter((field)=>!field.visibleWhen||
    values[field.visibleWhen.fieldKey]===field.visibleWhen.equals);
  const prepare=async()=>{
    setBusy(true);setError('');setFieldError(null);setQuote(null);
    try{
      if(!acceptedTerms)throw new Error('Accept the marketplace use terms before preflight');
      if(!termsAccepted)await post('terms',{acceptanceId:crypto.randomUUID(),version:1,accepted:true});
      for(const field of current){if(field.type==='JSON'&&rawJson[field.key]?.trim()){
        try{JSON.parse(rawJson[field.key]!);}catch{throw new Error(`${field.label}: enter valid JSON`);}
      }}
      const assets:Assets=Object.fromEntries(Object.entries(ownedAssets)
        .filter(([,ids])=>ids.length>0));
      for(const field of current){
        if(field.type!=='FILE'&&field.type!=='FILES')continue;
        const selected=files[field.key]??[];
        if(selected.length===0)continue;
        assets[field.key]=[];
        for(const file of selected){
          if(file.size>field.constraints.maxFileSizeBytes)throw new Error(`${field.label}: file exceeds seller limit`);
          const hasher=sha256.create();
          const reader=file.stream().getReader();
          try{for(;;){const chunk=await reader.read();if(chunk.done)break;
            hasher.update(chunk.value);}}
          finally{reader.releaseLock();}
          const digest=Array.from(hasher.digest())
            .map((byte)=>byte.toString(16).padStart(2,'0')).join('');
          const digestClaim=`sha256:${digest}`;
          const cleanedName=file.name.replace(/[^A-Za-z0-9._-]/g,'_');
          const prefixed=/^[A-Za-z0-9]/.test(cleanedName)?cleanedName:`file_${cleanedName}`;
          const extension=prefixed.includes('.')?prefixed.slice(prefixed.lastIndexOf('.')):'';
          const safeName=prefixed.length<=128?prefixed:
            `${prefixed.slice(0,128-extension.length)}${extension}`;
          const shared={capabilityId:detail.id,fieldKey:field.key,
            fileName:safeName,
            sizeBytes:file.size,sha256:digestClaim};
          const started=await post<{id:string;url:string;headers:Record<string,string>}>(
            'upload-begin',{...shared,contentType:file.type||'application/octet-stream'});
          const sent=await fetch(started.url,{method:'PUT',headers:started.headers,body:file});
          if(!sent.ok)throw new Error(`${field.label}: upload failed`);
          await post('upload-finalize',{assetId:started.id,capabilityId:detail.id,
            fieldKey:field.key});
          assets[field.key]!.push(started.id);
        }
      }
      const visibleValues=Object.fromEntries(Object.entries(values).filter(([key,value])=>
        value!==undefined&&value!==''&&current.some((field)=>field.key===key&&
          field.type!=='FILE'&&field.type!=='FILES')));
      const prepared={values:visibleValues,assets};
      const result=await post<QuoteResponse>('preflight',{capabilityId:detail.id,
        quoteId:crypto.randomUUID(),expectedVersionId:detail.version.id,mode,
        ...(deadline?{latestAcceptableStartAt:new Date(deadline).toISOString()}:{}),
        payload:prepared});
      setQuote(result);setPayload(prepared);
    }catch(cause){const message=cause instanceof Error?cause.message:'Preflight failed';
      const field=current.find((item)=>message.startsWith(`${item.label}:`));
      if(field)setFieldError({key:field.key,message});else setError(message);}
    finally{setBusy(false);}
  };
  const purchase=async()=>{
    if(!quote||!payload||!quote.canAfford)return;
    setBusy(true);setError('');
    const attempt=purchaseAttempt.current?.quoteId===quote.quote.id?purchaseAttempt.current:
      {quoteId:quote.quote.id,jobId:crypto.randomUUID(),reservationId:crypto.randomUUID(),
        manifestId:crypto.randomUUID()};
    purchaseAttempt.current=attempt;
    try{
      const booked=await post<{jobId:string}>('purchase',{...attempt,payload});
      window.location.assign(`/buyer/jobs/${booked.jobId}`);
    }catch(cause){
      // A response can disappear after the PostgreSQL commit. Probe the exact
      // job and retain its stable IDs so retry cannot create another purchase.
      try{const existing=await fetch(`/api/marketplace/job/${attempt.jobId}`);
        if(existing.ok){window.location.assign(`/buyer/jobs/${attempt.jobId}`);return;}
      }catch{/* Keep the same IDs for a safe retry. */}
      const message=cause instanceof Error?cause.message:'Purchase failed';
      if(['STALE_QUOTE','CONFLICT','NOT_ELIGIBLE'].includes(message)){
        setQuote(null);purchaseAttempt.current=null;
      }
      setError(message);
    }
    finally{setBusy(false);}
  };
  const toggleFavorite=async()=>{
    try{await post('favorite',{capabilityId:detail.id,favorite:!favorite});setFavorite(!favorite);}
    catch(cause){setError(cause instanceof Error?cause.message:'Could not save favorite');}
  };
  return <section className="run-panel" aria-labelledby="run-title"><div className="run-panel-heading"><div><p className="form-eyebrow">START A NEW JOB</p><h2 id="run-title">Prepare your inputs</h2></div><button type="button" className="favorite-button" onClick={toggleFavorite} aria-pressed={favorite}><Icon name="heart"/>{favorite?'Saved':'Save'}</button></div>
    {sourceLabel&&<p className="notice success">{sourceLabel}. This is a new purchase using the current version and current price.</p>}
    {changeWarning&&<p className="notice error" role="alert">{changeWarning}</p>}
    <p className="run-helper">Your inputs are processed on the seller’s machine in an isolated job. Only the declared inputs reach the Worker. Review the permission summary above before uploading sensitive material.</p>
    <div className="run-fields">{current.map((field,index)=><Fragment key={field.key}>{field.group&&
      (index===0||current[index-1]?.group!==field.group)&&
      <h3 className="run-group-title">{field.group}</h3>}<label className="run-field"><span>{field.label}{field.required?' *':''}</span>{field.description&&<small>{field.description}</small>}
      {field.type==='BOOLEAN'?<input type="checkbox" checked={values[field.key]===true} aria-invalid={fieldError?.key===field.key} aria-describedby={fieldError?.key===field.key?`run-error-${field.key}`:undefined} onChange={(e)=>update(field.key,e.target.checked)}/>:
      field.type==='SELECT'?<select value={String(values[field.key]??'')} aria-invalid={fieldError?.key===field.key} aria-describedby={fieldError?.key===field.key?`run-error-${field.key}`:undefined} onChange={(e)=>update(field.key,e.target.value)} required={field.required}><option value="">Select an option</option>{field.constraints.allowedValues.map((item)=><option key={item}>{item}</option>)}</select>:
      field.type==='MULTI_SELECT'?<select multiple value={Array.isArray(values[field.key])?values[field.key] as string[]:[]} aria-invalid={fieldError?.key===field.key} aria-describedby={fieldError?.key===field.key?`run-error-${field.key}`:undefined} onChange={(e)=>update(field.key,Array.from(e.target.selectedOptions).map((o)=>o.value))}>{field.constraints.allowedValues.map((item)=><option key={item}>{item}</option>)}</select>:
      field.type==='FILE'||field.type==='FILES'?<><input type="file" multiple={field.type==='FILES'} accept={field.constraints.allowedExtensions.join(',')} aria-invalid={fieldError?.key===field.key} aria-describedby={fieldError?.key===field.key?`run-error-${field.key}`:undefined} onChange={(e)=>{setFiles((old)=>({...old,[field.key]:Array.from(e.target.files??[])}));setOwnedAssets((old)=>({...old,[field.key]:[]}));setFieldError((old)=>old?.key===field.key?null:old);setQuote(null);}}/>{(ownedAssets[field.key]?.length??0)>0&&<small>{ownedAssets[field.key]!.length} private buyer file(s) selected by Marketplace Agent. Choosing a new file replaces this selection.</small>}</>:
      field.type==='LONG_TEXT'||field.type==='MARKDOWN'||field.type==='JSON'?<textarea rows={field.type==='JSON'?6:4} aria-invalid={fieldError?.key===field.key} aria-describedby={fieldError?.key===field.key?`run-error-${field.key}`:undefined} value={field.type==='JSON'?rawJson[field.key]??'':String(values[field.key]??'')} onChange={(e)=>{if(field.type==='JSON'){
        setRawJson((old)=>({...old,[field.key]:e.target.value}));setQuote(null);
        try{update(field.key,JSON.parse(e.target.value) as unknown);setError('');}
        catch{update(field.key,undefined);}
      }else update(field.key,e.target.value);}}/>:
      <input type={field.type==='INTEGER'||field.type==='NUMBER'?'number':field.type==='URL'?'url':'text'}
        step={field.type==='INTEGER'?'1':field.type==='NUMBER'?'any':undefined}
        aria-invalid={fieldError?.key===field.key} aria-describedby={fieldError?.key===field.key?`run-error-${field.key}`:undefined}
        value={String(values[field.key]??'')} onChange={(e)=>update(field.key,
          field.type==='INTEGER'||field.type==='NUMBER'?
            e.target.value===''?undefined:Number(e.target.value):e.target.value)} required={field.required}/>}
      {fieldError?.key===field.key&&<small id={`run-error-${field.key}`} className="field-error" role="alert">{fieldError.message}</small>}
    </label></Fragment>)}</div>
    <div className="run-preference"><h3>When should this run?</h3><label><input type="radio" name="mode" checked={mode==='IMMEDIATE_ONLY'} onChange={()=>{setMode('IMMEDIATE_ONLY');setQuote(null);}}/> As soon as possible while available</label><label><input type="radio" name="mode" checked={mode==='EARLIEST_AVAILABLE'} onChange={()=>{setMode('EARLIEST_AVAILABLE');setQuote(null);}}/> Earliest eligible window, including future schedule</label><label>Latest acceptable start (optional)<input type="datetime-local" value={deadline} onChange={(e)=>{setDeadline(e.target.value);setQuote(null);}}/></label></div>
    {!termsAccepted&&<label className="run-terms"><input type="checkbox" checked={acceptedTerms} onChange={(e)=>setAcceptedTerms(e.target.checked)}/> I have read and accept the <a href="/marketplace-terms" target="_blank" rel="noopener noreferrer">Marketplace use terms (version 1)</a>.</label>}
    <button type="button" className="primary-button run-button" disabled={busy||!canRequest} onClick={prepare}>{busy?'Checking…':canRequest?'Check price & availability':'New jobs temporarily unavailable'}</button>
    {error&&<p className="notice error" role="alert">{friendlyError(error)}</p>}
    {quote&&<div className="run-quote" role="status"><p className="form-eyebrow">CURRENT EXECUTION QUOTE</p><div className="run-quote-price"><strong>{money(quote.quote.price.buyerAmountMinor)}</strong><span>fixed price · version {detail.version.number}</span></div>
      <p>{availabilityLabel(detail.availability.status,detail.availability.acceptingQueue)}. Earliest eligible start: {new Date(quote.quote.earliestEligibleAt).toLocaleString()}. Latest start under this quote: {new Date(quote.quote.latestStartAt).toLocaleString()}.</p>
      <p>Start time is not guaranteed. No completion ETA is available until sufficient execution history exists. Quote expires {new Date(quote.quote.quoteExpiresAt).toLocaleTimeString()}.</p>
      {mode==='EARLIEST_AVAILABLE'&&<p>Your credits will be reserved now. Execution starts only when an eligible seller window and Worker are available, before your latest acceptable start.</p>}
      <p>Credits available: {money(quote.balance.availableMinor)} · reserved: {money(quote.balance.reservedMinor)}</p>
      {quote.canAfford?<button type="button" className="primary-button run-button" disabled={busy||Date.parse(quote.quote.quoteExpiresAt)<=Date.now()} onClick={purchase}>Confirm purchase & reserve credits</button>:
        <p className="notice error">Insufficient Kivro Credits. Add credits in your account before purchasing.</p>}
      <p className="run-fineprint">Credits are reserved before the job can execute. Eligible cancellation before execution releases them. Failed jobs follow the published refund policy.</p></div>}
  </section>;
}
