'use client';

import { useEffect, useState } from 'react';

type Visibility='DRAFT'|'PRIVATE'|'UNLISTED'|'PUBLIC';
type Grant={id:string;buyerAccountId:string;buyerEmail:string};

export default function SellerVisibilityControl({capabilityId,slug,visibility,onChanged}:{
  capabilityId:string;slug:string;visibility:Visibility;onChanged:()=>Promise<void>}){
  const [target,setTarget]=useState<'PRIVATE'|'UNLISTED'|'PUBLIC'>(
    visibility==='DRAFT'?'PRIVATE':visibility);
  const [pending,setPending]=useState(false);
  const [message,setMessage]=useState<string|null>(null);
  const [retry,setRetry]=useState<{from:Visibility;to:typeof target;id:string}|null>(null);
  const [grants,setGrants]=useState<Grant[]>([]);
  const [buyerEmail,setBuyerEmail]=useState('');
  const [grantPending,setGrantPending]=useState(false);
  useEffect(()=>{
    setTarget(visibility==='DRAFT'?'PRIVATE':visibility);
    if(visibility!=='PRIVATE'){setGrants([]);return;}
    let active=true;
    void fetch(`/api/seller/publication/grants?capabilityId=${encodeURIComponent(capabilityId)}`,
      {cache:'no-store'}).then(async(response)=>{
        if(!response.ok)throw new Error('GRANTS_UNAVAILABLE');
        return response.json() as Promise<{grants:Grant[]}>;
      }).then((result)=>{if(active)setGrants(result.grants);})
      .catch(()=>{if(active)setMessage('Private access list is unavailable. Reload to retry.');});
    return ()=>{active=false;};
  },[capabilityId,visibility]);
  const refreshGrants=async()=>{
    const response=await fetch(`/api/seller/publication/grants?capabilityId=${
      encodeURIComponent(capabilityId)}`,{cache:'no-store'});
    if(!response.ok)throw new Error('GRANTS_UNAVAILABLE');
    const result=await response.json() as {grants:Grant[]};
    setGrants(result.grants);
  };
  const change=async()=>{
    if(pending||target===visibility)return;
    const requestId=retry?.from===visibility&&retry.to===target?retry.id:crypto.randomUUID();
    setRetry({from:visibility,to:target,id:requestId});setPending(true);setMessage(null);
    try{
      const response=await fetch('/api/seller/publication/visibility',{method:'POST',
        headers:{'content-type':'application/json'},body:JSON.stringify({capabilityId,
          expected:visibility,desired:target,requestId})});
      if(!response.ok){const body=await response.json() as {code?:string};
        setMessage(body.code==='PUBLIC_NOT_READY'
          ? 'Public listing needs fresh Worker and sandbox readiness plus current seller payout eligibility.'
          : body.code==='CONFLICT'?'Visibility changed. Reload and review the current state.'
            :'Visibility could not be changed.');return;}
      setRetry(null);await onChanged();
      setMessage(target==='PRIVATE'?'Private access is now limited to explicit grants.':
        target==='UNLISTED'?'This capability is available by its direct link.':
          'This capability is now listed publicly.');
    }catch{setMessage('Connection lost. Retry the same request; the change is idempotent.');}
    finally{setPending(false);}
  };
  const grant=async()=>{
    if(grantPending||!buyerEmail.trim())return;
    setGrantPending(true);setMessage(null);
    try{
      const response=await fetch('/api/seller/publication/grants',{method:'POST',
        headers:{'content-type':'application/json'},body:JSON.stringify({capabilityId,
          buyerEmail:buyerEmail.trim(),grantId:crypto.randomUUID()})});
      if(!response.ok){setMessage('Grant failed. Use a separate verified buyer account and check it has not already been granted.');return;}
      setBuyerEmail('');await refreshGrants();setMessage('Private access granted. This does not waive payment.');
    }catch{setMessage('Grant status is uncertain. Reload the grant list before retrying.');}
    finally{setGrantPending(false);}
  };
  const revoke=async(grantId:string)=>{
    if(grantPending)return;
    setGrantPending(true);setMessage(null);
    try{
      const response=await fetch('/api/seller/publication/revoke-grant',{method:'POST',
        headers:{'content-type':'application/json'},body:JSON.stringify({capabilityId,grantId})});
      if(!response.ok)throw new Error('REVOKE_FAILED');
      await refreshGrants();setMessage('Private access revoked for new requests. Existing jobs keep their terms.');
    }catch{setMessage('Revocation could not be confirmed. Reload and check the grant list.');}
    finally{setGrantPending(false);}
  };
  return <section className="seller-visibility-control" aria-label="Capability visibility and test access">
    <h3>Who can find this capability</h3>
    <p>Visibility controls new discovery and purchases. It does not cancel jobs already accepted.</p>
    <div className="seller-visibility-form"><label htmlFor={`visibility-${capabilityId}`}>
      Visibility<select id={`visibility-${capabilityId}`} value={target}
        onChange={(event)=>setTarget(event.target.value as typeof target)}>
        <option value="PRIVATE">Private · explicit buyer grants only</option>
        <option value="UNLISTED">Unlisted · direct link</option>
        <option value="PUBLIC">Public · marketplace discovery</option>
      </select></label>
      <button type="button" className="secondary-button" disabled={pending||target===visibility}
        onClick={()=>void change()}>{pending?'Checking eligibility…':'Save visibility'}</button></div>
    {(visibility==='UNLISTED'||visibility==='PUBLIC')&&<p className="seller-share-link">
      Direct link: <a href={`/capabilities/${slug}`}>/capabilities/{slug}</a></p>}
    {visibility==='PRIVATE'&&<div className="seller-private-grants">
      <h4>Private buyer access</h4>
      <p>Only explicitly granted marketplace accounts can open the buyer page. They still use the normal payment and job flow. Leaving Private revokes these grants.</p>
      <div className="seller-visibility-form"><label htmlFor={`grant-email-${capabilityId}`}>
        Verified buyer email<input id={`grant-email-${capabilityId}`} type="email"
          autoComplete="off" value={buyerEmail} onChange={(event)=>setBuyerEmail(event.target.value)}
          placeholder="buyer@example.com" /></label>
        <button type="button" className="secondary-button" disabled={grantPending||!buyerEmail.trim()}
          onClick={()=>void grant()}>{grantPending?'Saving…':'Grant access'}</button></div>
      {grants.length===0?<p>No buyer accounts have access.</p>:<ul>{grants.map((entry)=><li key={entry.id}>
        <span>{entry.buyerEmail}</span><button type="button" disabled={grantPending}
          onClick={()=>void revoke(entry.id)}>Revoke</button></li>)}</ul>}
    </div>}
    {message&&<p role="status" className="notice">{message}</p>}
  </section>;
}
