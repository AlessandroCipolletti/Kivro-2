'use client';
import { useEffect,useState } from 'react';
async function post(path:string,body:unknown):Promise<void>{
  const response=await fetch(`/api/marketplace/${path}`,{method:'POST',
    headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  if(!response.ok){const error=await response.json() as {code?:string};throw new Error(error.code??'REQUEST_FAILED');}
}
export function JobActions({jobId,canCancel,canReview}:{jobId:string;canCancel:boolean;canReview:boolean}){
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [ready,setReady]=useState(false);
  useEffect(()=>setReady(true),[]);
  const [rating,setRating]=useState(5),[text,setText]=useState('');
  const [category,setCategory]=useState('MISSING_OUTPUT'),[description,setDescription]=useState('');
  const [abuseCategory,setAbuseCategory]=useState('UNSAFE_OUTPUT');
  const cancel=async()=>{setBusy(true);setError('');try{
    await post('cancel',{jobId,requestId:crypto.randomUUID()});window.location.reload();
  }catch(cause){setError(cause instanceof Error?cause.message:'Cancellation failed');}
  finally{setBusy(false);}};
  const review=async()=>{setBusy(true);setError('');try{
    await post('review',{id:crypto.randomUUID(),jobId,rating,text});
    setMessage('Your verified review was saved.');window.location.reload();
  }catch(cause){setError(cause instanceof Error?cause.message:'Review failed');}
  finally{setBusy(false);}};
  const report=async()=>{setBusy(true);setError('');try{
    await post('problem',{id:crypto.randomUUID(),jobId,category,description});
    setMessage('Your problem report was recorded.');setDescription('');
  }catch(cause){setError(cause instanceof Error?cause.message:'Report failed');}
  finally{setBusy(false);}};
  const reportAbuse=async()=>{setBusy(true);setError('');try{
    await post('abuse-report',{id:crypto.randomUUID(),jobId,category:abuseCategory});
    setMessage('Your safety report was recorded for review.');
  }catch(cause){setError(cause instanceof Error?cause.message:'Safety report failed');}
  finally{setBusy(false);}};
  return <div className="job-actions">{canCancel&&<div className="job-action-block"><h3>Cancel before execution</h3><p>If execution has not begun, cancellation releases the reserved credits. Kivro resolves any claim race on the server.</p><button type="button" onClick={cancel} disabled={busy||!ready}>Cancel this job</button></div>}
    {canReview&&<div className="job-action-block"><h3>Review this job</h3><p>Verified reviews are tied to completed paid jobs.</p><label>Rating<select value={rating} onChange={(e)=>setRating(Number(e.target.value))}>{[5,4,3,2,1].map((item)=><option key={item} value={item}>{item} stars</option>)}</select></label><label>Your review<textarea maxLength={1200} rows={3} value={text} onChange={(e)=>setText(e.target.value)}/></label><button type="button" disabled={busy||!ready} onClick={review}>Publish verified review</button></div>}
    <div className="job-action-block"><h3>Report a problem</h3><p>Tell Kivro if a result is missing, corrupt or otherwise problematic. This report does not itself change the financial state.</p><label>Issue<select value={category} onChange={(e)=>setCategory(e.target.value)}><option value="MISSING_OUTPUT">Missing output</option><option value="CORRUPT_FILE">Corrupt file</option><option value="QUALITY">Quality concern</option><option value="OTHER">Other</option></select></label><label>What happened?<textarea rows={4} minLength={10} maxLength={2000} value={description} onChange={(e)=>setDescription(e.target.value)}/></label><button type="button" disabled={busy||!ready||description.trim().length<10} onClick={report}>Send problem report</button></div>
    <div className="job-action-block"><h3>Report unsafe behavior</h3><p>Send a category and job ID to the safety team. Job inputs and result files are not included in this report.</p><label>Safety concern<select value={abuseCategory} onChange={(e)=>setAbuseCategory(e.target.value)}><option value="UNSAFE_OUTPUT">Unsafe output</option><option value="HARASSMENT">Harassment</option><option value="FRAUD">Fraud</option><option value="PRIVACY">Privacy</option><option value="OTHER">Other</option></select></label><button type="button" disabled={busy||!ready} onClick={reportAbuse}>Send safety report</button></div>
    {error&&<p className="notice error" role="alert">{error.replaceAll('_',' ')}</p>}{message&&<p className="notice success" role="status">{message}</p>}
  </div>;
}
