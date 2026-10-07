'use client';

import { useCallback,useEffect,useState } from 'react';

type Key={id:string;name:string;prefix:string;scopes:string[];createdAt:string;
  lastUsedAt:string|null;expiresAt:string|null;revokedAt:string|null};
type Hook={id:string;url:string;events:string[];status:string;createdAt:string;
  lastSuccessAt:string|null;lastFailureAt:string|null;failureCount:number};
type Delivery={id:string;eventId:string;type:string;state:string;attemptCount:number;
  lastHttpStatus:number|null;lastErrorCode:string|null;nextAttemptAt:string};
const scopes=['capabilities:read','jobs:create','jobs:read','assets:create',
  'assets:read','webhooks:manage'] as const;
const events=['job.completed','job.failed','job.cancelled','job.started'] as const;
const stamp=(value:string|null)=>value?new Intl.DateTimeFormat(undefined,{dateStyle:'medium',
  timeStyle:'short'}).format(new Date(value)):'Never';
async function api(path:string,method:'GET'|'POST'|'PATCH'|'DELETE'='GET',value?:unknown){
  const response=await fetch(`/api/buyer/integrations/${path}`,{method,
    ...(value===undefined?{}:{headers:{'content-type':'application/json'},body:JSON.stringify(value)})});
  const data=await response.json() as Record<string,unknown>;
  if(!response.ok)throw new Error(String(data.code??'REQUEST_FAILED'));
  return data;
}
export default function BuyerIntegrations(){
  const [keys,setKeys]=useState<Key[]>([]),[hooks,setHooks]=useState<Hook[]>([]);
  const [selectedScopes,setSelectedScopes]=useState<string[]>(['capabilities:read','jobs:create',
    'jobs:read','assets:create','assets:read']);
  const [selectedEvents,setSelectedEvents]=useState<string[]>(['job.completed','job.failed']);
  const [keyName,setKeyName]=useState(''),[expiry,setExpiry]=useState('');
  const [hookUrl,setHookUrl]=useState(''),[newSecret,setNewSecret]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null);
  const [busy,setBusy]=useState(false),[deliveries,setDeliveries]=useState<Delivery[]|null>(null);
  const [openHook,setOpenHook]=useState<string|null>(null);
  const [editingHook,setEditingHook]=useState<string|null>(null);
  const [editUrl,setEditUrl]=useState(''),[editEvents,setEditEvents]=useState<string[]>([]);
  const load=useCallback(async()=>{
    const [keyData,hookData]=await Promise.all([api('keys'),api('webhooks')]);
    setKeys(keyData.keys as Key[]);setHooks(hookData.endpoints as Hook[]);
  },[]);
  useEffect(()=>{void load().catch(()=>setError('Unable to load integrations. Try again.'));},[load]);
  const action=async(work:()=>Promise<void>)=>{
    setBusy(true);setError(null);setNotice(null);
    try{await work();await load();}catch(cause){setError(cause instanceof Error?cause.message:'REQUEST_FAILED');}
    finally{setBusy(false);}
  };
  const toggle=(items:string[],item:string,set:(value:string[])=>void)=>
    set(items.includes(item)?items.filter((value)=>value!==item):[...items,item]);
  return <section className="integrations" aria-labelledby="integrations-title">
    <div className="integrations-intro"><p className="eyebrow">Developer access</p>
      <h2 id="integrations-title">API keys and webhooks</h2>
      <p>Use buyer keys for the versioned API. Worker pairing uses separate credentials.
        Keys and webhook secrets appear only once; keep them in your own secret store.</p></div>
    {error&&<p role="alert" className="notice error">{error}</p>}
    {notice&&<p role="status" className="notice success">{notice}</p>}
    {newSecret&&<div className="integration-secret" role="status"><div><strong>Copy this secret now</strong>
      <p>It will not be displayed again. Do not put it in a URL or source code.</p></div>
      <code>{newSecret}</code><button type="button" onClick={()=>setNewSecret(null)}>I saved it</button></div>}
    <div className="integrations-grid"><section className="integration-panel"><div className="integration-head">
      <span>01 / API keys</span><h3>Programmatic access</h3><p>Each key has its own scopes and can be revoked independently.</p></div>
      <form onSubmit={(event)=>{event.preventDefault();void action(async()=>{
        const data=await api('keys','POST',{name:keyName,scopes:selectedScopes,
          expiresAt:expiry?new Date(expiry).toISOString():null});
        setNewSecret((data.key as {secret:string}).secret);setKeyName('');setExpiry('');
      });}}><label>Key name<input value={keyName} onChange={(event)=>setKeyName(event.target.value)}
        maxLength={80} required placeholder="Production automation" /></label>
        <fieldset><legend>Allowed actions</legend>{scopes.map((scope)=><label key={scope} className="integration-check">
          <input type="checkbox" checked={selectedScopes.includes(scope)}
            onChange={()=>toggle(selectedScopes,scope,setSelectedScopes)}/>{scope}</label>)}</fieldset>
        <label>Optional expiration<input type="datetime-local" value={expiry}
          onChange={(event)=>setExpiry(event.target.value)}/></label>
        <button className="primary-button" type="submit" disabled={busy||!!newSecret||!selectedScopes.length}>Create key</button>
      </form><div className="integration-list"><h4>Your keys</h4>{keys.length===0?<p>No keys yet.</p>:
        keys.map((key)=><article key={key.id}><strong>{key.name}</strong>
          <span>{key.prefix}… · {key.revokedAt?'Revoked':key.expiresAt&&
            new Date(key.expiresAt)<new Date()?'Expired':'Active'}</span>
          <small>{key.scopes.join(' · ')}</small><small>Last used {stamp(key.lastUsedAt)}
            {key.expiresAt?` · Expires ${stamp(key.expiresAt)}`:''}</small>
          {!key.revokedAt&&<div className="integration-actions"><button type="button" disabled={busy||!!newSecret}
            onClick={()=>void action(async()=>{const data=await api(`keys/${key.id}/rotate`,'POST');
              setNewSecret((data.key as {secret:string}).secret);})}>Rotate</button>
            <button type="button" disabled={busy} onClick={()=>void action(async()=>{
              await api(`keys/${key.id}/revoke`,'POST');setNotice('Key revoked.');
            })}>Revoke</button></div>}</article>)}</div></section>
    <section className="integration-panel"><div className="integration-head"><span>02 / Webhooks</span>
      <h3>Know when work is ready</h3><p>We send signed event metadata. Fetch results with your buyer key.</p></div>
      <form onSubmit={(event)=>{event.preventDefault();void action(async()=>{
        const data=await api('webhooks','POST',{url:hookUrl,events:selectedEvents});
        setNewSecret((data.endpoint as {secret:string}).secret);setHookUrl('');
      });}}><label>HTTPS endpoint<input type="url" value={hookUrl} required
        onChange={(event)=>setHookUrl(event.target.value)} placeholder="https://example.com/kivro/events"/></label>
        <fieldset><legend>Events</legend>{events.map((item)=><label key={item} className="integration-check">
          <input type="checkbox" checked={selectedEvents.includes(item)}
            onChange={()=>toggle(selectedEvents,item,setSelectedEvents)}/>{item}</label>)}</fieldset>
        <button className="primary-button" type="submit" disabled={busy||!!newSecret||!selectedEvents.length}>
          Add endpoint</button></form><div className="integration-list"><h4>Your endpoints</h4>
        {hooks.length===0?<p>No endpoints yet.</p>:hooks.map((hook)=><article key={hook.id}>
          <strong className="integration-url">{hook.url}</strong><span>{hook.status} ·
            {hook.events.join(', ')}</span><small>Last success {stamp(hook.lastSuccessAt)} ·
              Last failure {stamp(hook.lastFailureAt)} · {hook.failureCount} failures</small>
          <div className="integration-actions"><button type="button" disabled={busy}
            onClick={()=>void action(async()=>{const data=await api(`webhooks/${hook.id}/test`,'POST');
              setNotice(`Test event ${String(data.eventId)} queued.`);})}>Send test</button>
            <button type="button" disabled={busy||!!newSecret} onClick={()=>void action(async()=>{
              const data=await api(`webhooks/${hook.id}/rotate-secret`,'POST');
              setNewSecret(String(data.secret));})}>Rotate secret</button>
            <button type="button" disabled={busy} onClick={()=>void action(async()=>{
              await api(`webhooks/${hook.id}`,'PATCH',{enabled:hook.status==='DISABLED'});
            })}>{hook.status==='DISABLED'?'Enable':'Disable'}</button>
            <button type="button" disabled={busy} onClick={()=>{
              setEditingHook(editingHook===hook.id?null:hook.id);
              setEditUrl(hook.url);setEditEvents(hook.events);
            }}>{editingHook===hook.id?'Close edit':'Edit'}</button>
            <button type="button" disabled={busy} onClick={()=>void action(async()=>{
              await api(`webhooks/${hook.id}`,'DELETE');
              if(openHook===hook.id){setOpenHook(null);setDeliveries(null);}
              setEditingHook(null);setNotice('Endpoint removed.');
            })}>Remove</button>
            <button type="button" onClick={()=>void (async()=>{
              if(openHook===hook.id){setOpenHook(null);setDeliveries(null);return;}
              try{const data=await api(`webhooks/${hook.id}/deliveries`);
                setDeliveries(data.deliveries as Delivery[]);setOpenHook(hook.id);}
              catch{setError('Unable to load delivery history.');}
            })()}>Deliveries</button></div>
          {editingHook===hook.id&&<form className="integration-edit" onSubmit={(event)=>{
            event.preventDefault();void action(async()=>{await api(`webhooks/${hook.id}`,'PATCH',
              {url:editUrl,events:editEvents});setEditingHook(null);});}}>
            <label>Endpoint URL<input type="url" required value={editUrl}
              onChange={(event)=>setEditUrl(event.target.value)}/></label>
            <fieldset><legend>Subscribed events</legend>{events.map((item)=><label key={item}
              className="integration-check"><input type="checkbox" checked={editEvents.includes(item)}
              onChange={()=>toggle(editEvents,item,setEditEvents)}/>{item}</label>)}</fieldset>
            <button className="primary-button" type="submit" disabled={busy||!editEvents.length}>
              Save endpoint</button>
          </form>}
          {openHook===hook.id&&<div className="integration-deliveries">
            {!deliveries?.length?<p>No deliveries yet.</p>:deliveries.map((delivery)=><p key={delivery.id}>
              <strong>{delivery.type}</strong> · {delivery.state} · {delivery.attemptCount} attempts
              {delivery.lastHttpStatus?` · HTTP ${delivery.lastHttpStatus}`:''}
              {delivery.lastErrorCode?` · ${delivery.lastErrorCode}`:''}</p>)}</div>}
        </article>)}</div></section></div>
    <p className="integration-foot">Use <code>Authorization: Bearer &lt;key&gt;</code> with
      <code> /v1</code>. Verify <code>Marketplace-Signature</code> over the timestamp and exact
      raw body, reject stale timestamps and deduplicate event IDs. Delivery is at least once.</p>
  </section>;
}
