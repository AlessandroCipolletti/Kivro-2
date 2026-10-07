'use client';

import { useEffect, useState } from 'react';
import SellerVisibilityControl from './seller-visibility-control';

type Version={id:string;versionNumber:number;lifecycle:string;
  price:{buyerAmountMinor:number;platformFeeMinor:number;sellerEarningMinor:number};
  workerManifestHash:string;permissionPolicyHash:string;
  publicPermissionManifest:{entries:{category:string;state:string}[]};
  ioContract:{input:{fields:{key:string;label:string;type:string}[]};
    output:{fields:{key:string;label:string;type:string}[]}};
  dependencySnapshot:{id:string;contentHash:string}[]};
type History={capabilityId:string;slug:string;name:string;
  visibility:'DRAFT'|'PRIVATE'|'UNLISTED'|'PUBLIC';
  currentVersionId:string|null;versions:Version[]};

function money(minor:number):string{return `$${(minor/100).toFixed(2)}`;}
function changes(current:Version,target:Version):string[]{
  const result:string[]=[];
  if(current.price.buyerAmountMinor!==target.price.buyerAmountMinor)
    result.push(`Buyer price ${money(current.price.buyerAmountMinor)} → ${money(target.price.buyerAmountMinor)}`);
  const before=new Map(current.publicPermissionManifest.entries.map((entry)=>[entry.category,entry.state]));
  for(const entry of target.publicPermissionManifest.entries){
    const prior=before.get(entry.category);
    if(prior!==entry.state)result.push(`${entry.category.replaceAll('_',' ')}: ${prior??'unknown'} → ${entry.state}`);
  }
  const changed=(kind:'input'|'output')=>JSON.stringify(current.ioContract[kind].fields)!==
    JSON.stringify(target.ioContract[kind].fields);
  if(changed('input'))result.push('Input contract differs');
  if(changed('output'))result.push('Output contract differs');
  if(current.workerManifestHash!==target.workerManifestHash)result.push('Skill or Worker manifest differs');
  if(current.permissionPolicyHash!==target.permissionPolicyHash)result.push('Permission policy differs');
  if(JSON.stringify(current.dependencySnapshot)!==JSON.stringify(target.dependencySnapshot))
    result.push('Dependency snapshot differs');
  return result.length?result:['No buyer-visible contract change'];
}

export default function SellerVersionControl(){
  const [histories,setHistories]=useState<History[]>([]);
  const [state,setState]=useState<'loading'|'ready'|'error'>('loading');
  const [approved,setApproved]=useState<string|null>(null);
  const [pending,setPending]=useState<string|null>(null);
  const [retry,setRetry]=useState<{targetId:string;requestId:string}|null>(null);
  const [message,setMessage]=useState<string|null>(null);
  const load=async()=>{try{
    const response=await fetch('/api/seller/publication/versions',{cache:'no-store'});
    if(!response.ok)throw new Error('VERSION_HISTORY_UNAVAILABLE');
    const body=await response.json() as {capabilities:History[]};
    setHistories(body.capabilities);setState('ready');
  }catch{setState('error');}};
  useEffect(()=>{void load();},[]);
  const rollback=async(capability:History,target:Version)=>{
    if(pending||approved!==target.id||!capability.currentVersionId)return;
    const previous=retry?.targetId===target.id?retry.requestId:crypto.randomUUID();
    setRetry({targetId:target.id,requestId:previous});setPending(target.id);setMessage(null);
    try{
      const response=await fetch('/api/seller/publication/rollback',{method:'POST',
        headers:{'content-type':'application/json'},body:JSON.stringify({
          capabilityId:capability.capabilityId,targetVersionId:target.id,
          expectedCurrentVersionId:capability.currentVersionId,requestId:previous})});
      if(!response.ok){const body=await response.json() as {code?:string};
        setMessage(body.code==='ROLLBACK_NOT_READY'
          ? 'Rollback blocked: this version needs fresh Worker, sandbox, dependency and secret readiness.'
          : body.code==='CONFLICT'?'The active version changed. Reload and review it again.'
            :'Rollback could not be completed. No version was changed.');return;}
      setRetry(null);setApproved(null);
      setMessage('Previous version selected. New jobs stay paused until you verify readiness and resume.');
      await load();
    }catch{setMessage('Connection lost. Retry the same request; rollback is idempotent.');}
    finally{setPending(null);}
  };
  return <section className="seller-version-control" aria-labelledby="seller-versions-heading">
    <div className="publication-heading"><p className="eyebrow">Version history</p>
      <h2 id="seller-versions-heading">Choose which version receives new jobs.</h2>
      <p>Historical versions and existing jobs remain unchanged. A rollback requires fresh Worker readiness and starts paused.</p></div>
    {state==='loading'&&<p role="status">Loading your versions…</p>}
    {state==='error'&&<p role="alert" className="notice error">Version history is unavailable. <button type="button" onClick={()=>void load()}>Retry</button></p>}
    {state==='ready'&&histories.length===0&&<p className="seller-muted">No published versions yet.</p>}
    {message&&<p role="status" className="notice">{message}</p>}
    {state==='ready'&&histories.map((capability)=>{
      const current=capability.versions.find((version)=>version.id===capability.currentVersionId);
      return <details className="publication-review" key={capability.capabilityId}>
        <summary><strong>{capability.name}</strong> · {capability.visibility.toLowerCase()} · {current?`v${current.versionNumber} active`:'No active version'}</summary>
        <div className="seller-version-list">{capability.versions.map((version)=>{
          const active=version.id===capability.currentVersionId;
          return <div className="seller-version-row" key={version.id}>
            <div><strong>v{version.versionNumber}{active?' · active':''}</strong>
              <p>Buyer {money(version.price.buyerAmountMinor)} · seller {money(version.price.sellerEarningMinor)} · {version.lifecycle.toLowerCase()}</p>
              {!active&&current&&<ul>{changes(current,version).map((change)=><li key={change}>{change}</li>)}</ul>}</div>
            {!active&&version.lifecycle==='RETIRED'&&current&&<div className="seller-version-action">
              <label><input type="checkbox" checked={approved===version.id}
                onChange={(event)=>setApproved(event.target.checked?version.id:null)} />
                <span>I reviewed this version’s terms and access.</span></label>
              <button type="button" className="secondary-button" disabled={approved!==version.id||Boolean(pending)}
                onClick={()=>void rollback(capability,version)}>{pending===version.id?'Checking readiness…':`Make v${version.versionNumber} active`}</button>
            </div>}
          </div>;
        })}</div>
        <SellerVisibilityControl capabilityId={capability.capabilityId}
          slug={capability.slug} visibility={capability.visibility}
          onChanged={load} />
      </details>;
    })}
  </section>;
}
