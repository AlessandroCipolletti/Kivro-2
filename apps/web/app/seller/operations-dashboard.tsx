'use client';

import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { PublicPermissionManifestSchema } from '../../../../packages/contracts/src/permission-policy.js';
import { permissionCategoryLabel,permissionStateLabel } from '../ui/permission-copy';
import { availabilityLabel,availabilityReasonLabel,jobStatusLabel } from '../discover/marketplace-ui';

const windowSchema=z.object({dayOfWeek:z.number(),startLocalTime:z.string(),endLocalTime:z.string()});
const scheduleSchema=z.object({mode:z.enum(['ALWAYS_AVAILABLE','CUSTOM_SCHEDULE']),
  timezone:z.string(),weeklyWindows:z.array(windowSchema)});
const policySchema=z.object({schedule:scheduleSchema.nullable(),concurrencyLimit:z.number(),
  queueLimit:z.number(),futureReservationLimit:z.number(),estimatedRuntimeSeconds:z.number().nullable(),
  maxWaitSeconds:z.number()});
const availabilitySchema=z.object({status:z.string(),reason:z.string(),nextAvailableAt:z.string().nullable(),
  acceptingImmediate:z.boolean(),canSchedule:z.boolean()});
const availabilityMetricsSchema=z.object({periodDays:z.number(),observedMinutes:z.number(),
  unobservedMinutes:z.number(),onlineMinutesObserved:z.number(),busyMinutesObserved:z.number(),
  offlineMinutesObserved:z.number(),scheduledOfflineMinutesObserved:z.number(),
  pausedMinutesObserved:z.number(),readinessBlockedMinutesObserved:z.number(),
  unavailableMinutesObserved:z.number(),jobsAccepted:z.number(),queueFullRejects:z.number(),
  medianQueueWaitSeconds:z.number().nullable(),medianExecutionSeconds:z.number().nullable(),
  disconnectFailures:z.number(),source:z.literal('MINUTE_OBSERVATIONS')});
const dashboardSchema=z.object({profile:z.object({display_name:z.string(),status:z.string(),
  payout_status:z.string()}),workers:z.array(z.object({id:z.string(),name:z.string(),platform:z.string(),
  worker_version:z.string(),openclaw_version:z.string().nullable(),status:z.string(),
  lastHeartbeatAt:z.string().nullable(),running_jobs:z.number().nullable(),capacity:z.number().nullable(),
  global_paused:z.boolean().nullable(),security_paused:z.boolean().nullable(),
  web_paused:z.boolean().nullable(),security_blocked:z.boolean().nullable(),
  maintenanceUntil:z.string().nullable(),
  cloudSyncPending:z.boolean(),pending_jobs:z.number(),lastSuccessAt:z.string().nullable(),
  lastFailureAt:z.string().nullable(),average_runtime_seconds:z.number().nullable(),
  failure_rate:z.number().nullable(),latestWorkerRelease:z.string().nullable(),
  minimumWorkerRelease:z.string().nullable(),versionStatus:z.string(),
  operational_checks:z.array(z.object({code:z.string(),state:z.string()})).nullable(),
  openclaw_compatibility:z.string().nullable(),
  warnings:z.array(z.object({severity:z.string(),code:z.string(),scope:z.string(),
    blocking:z.boolean(),title:z.string(),description:z.string(),
    detectedAt:z.string().nullable(),action:z.string()}))})),capabilities:z.array(z.object({id:z.string(),slug:z.string(),
  name:z.string(),status:z.string(),worker_device_id:z.string().nullable(),
  price:z.object({buyerAmountMinor:z.number(),platformFeeMinor:z.number(),
    sellerEarningMinor:z.number()}).nullable(),
  permission_manifest:PublicPermissionManifestSchema.nullable(),
  readiness_state:z.string().nullable(),readinessAt:z.string().nullable(),
  maintenanceUntil:z.string().nullable(),
  runningCount:z.number(),lastSuccessAt:z.string().nullable(),
  lastFailureAt:z.string().nullable(),
  readinessFresh:z.boolean(),sandbox_verified:z.boolean().nullable(),
  required_secrets_ready:z.boolean().nullable(),runtime_healthy:z.boolean().nullable(),
  availability:availabilitySchema.nullable(),availabilityMetrics:availabilityMetricsSchema.nullable(),
  operations:z.object({
    schedule:scheduleSchema,inheritedFromWorker:z.boolean(),policy:policySchema,
    sellerPaused:z.boolean(),workerPaused:z.boolean(),platformBlocked:z.boolean(),
    insideServiceHours:z.boolean(),
    scheduledCount:z.number(),queuedCount:z.number(),nextDeadlineAt:z.string().nullable(),
    nextWindow:z.object({startAt:z.string(),endAt:z.string(),localDate:z.string(),
      timezone:z.string()}).nullable(),
    revision:z.number(),windowDemand:z.array(z.object({windowStartAt:z.string(),jobCount:z.number(),
      reservedBuyerValueMinor:z.number(),estimatedSellerEarningsMinor:z.number()}))}).nullable()})),
  jobs:z.array(z.object({id:z.string(),status:z.string(),created_at:z.string(),
    started_at:z.string().nullable(),completed_at:z.string().nullable(),capability_name:z.string(),
    worker_device_id:z.string(),
    payment_state:z.string().nullable(),pause_support:z.string().nullable(),
    audit:z.array(z.object({at:z.string(),kind:z.string(),code:z.string(),
      correlationId:z.string().nullable()})).default([]),
    execution_id:z.string().nullable(),attempt_id:z.string().nullable(),
    control_plane_id:z.string().nullable(),economics:z.object({buyerPriceMinor:z.number(),
      marketplaceFeeMinor:z.number(),sellerProceedsMinor:z.number(),
      providerCostMicroUsd:z.number().nullable(),providerCostEvidence:z.string(),
      estimatedNetProceedsMinor:z.number().nullable(),possibleLoss:z.boolean().nullable(),
      currency:z.literal('USD'),paymentState:z.string(),providerModels:z.array(z.string())})})),
  earnings:z.object({pendingMinor:z.number(),availableMinor:z.number(),transferredMinor:z.number(),
    paidOutMinor:z.number(),currency:z.literal('USD')}),
  settledSales:z.object({buyerSalesMinor:z.number(),marketplaceFeesMinor:z.number(),
    currency:z.literal('USD')}),
  economicsSummary:z.object({jobsToday:z.number(),jobsTotal:z.number(),
    completedJobs:z.number(),failedJobs:z.number(),failureRate:z.number().nullable(),
    averageRuntimeSeconds:z.number().nullable(),providerCosts:z.object({
      measuredMicroUsd:z.number(),estimatedMicroUsd:z.number(),measuredCalls:z.number(),
      estimatedCalls:z.number(),unknownJobs:z.number(),currency:z.literal('USD')})}),
  history:z.array(z.object({worker_device_id:z.string(),capability_id:z.string().nullable(),
    kind:z.string(),code:z.string(),created_at:z.string()}))});
type Dashboard=z.infer<typeof dashboardSchema>;
type Capability=Dashboard['capabilities'][number];
const dayNames=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const money=(minor:number)=>new Intl.NumberFormat(undefined,{style:'currency',currency:'USD'}).format(minor/100);
const stamp=(value:string|null)=>value?new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'Unknown';
function weekPreview(schedule:z.infer<typeof scheduleSchema>){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:schedule.timezone,
    year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date())
    .map((part)=>[part.type,part.value]));
  const origin=new Date(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day)));
  return Array.from({length:7},(_,offset)=>{
    const day=new Date(origin);day.setUTCDate(origin.getUTCDate()+offset);
    const weekday=day.getUTCDay()||7;
    const windows=schedule.mode==='ALWAYS_AVAILABLE'?['All day']:
      schedule.weeklyWindows.filter((item)=>item.dayOfWeek===weekday).map((item)=>
        item.startLocalTime==='00:00'&&item.endLocalTime==='24:00'?'All day':
          `${item.startLocalTime}–${item.endLocalTime}${item.endLocalTime<=item.startLocalTime?' next day':''}`);
    return {date:new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric',
      timeZone:'UTC'}).format(day),hours:windows.join(', ')||'Unavailable'};
  });
}

async function request(path:string,body:unknown):Promise<void>{
  const response=await fetch(`/api/seller/operations/${path}`,{method:'POST',
    headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  if(!response.ok){const error=await response.json() as {code?:string};
    throw new Error(error.code??`REQUEST_FAILED_${response.status}`);}
}

function ScheduleEditor({capability,onSaved}:{capability:Capability;onSaved:()=>void}){
  const operations=capability.operations;
  const [open,setOpen]=useState(false);
  const [mode,setMode]=useState<'ALWAYS_AVAILABLE'|'CUSTOM_SCHEDULE'>(operations?.schedule.mode??'ALWAYS_AVAILABLE');
  const [timezone,setTimezone]=useState(operations?.schedule.timezone??'UTC');
  const [windows,setWindows]=useState(operations?.schedule.weeklyWindows??[]);
  const [concurrency,setConcurrency]=useState(operations?.policy.concurrencyLimit??1);
  const [queue,setQueue]=useState(operations?.policy.queueLimit??0);
  const [pending,setPending]=useState(false),[error,setError]=useState<string|null>(null);
  if(!operations)return null;
  const add=(dayOfWeek:number)=>setWindows((prior)=>[...prior,{dayOfWeek,
    startLocalTime:'20:00',endLocalTime:'07:00'}]);
  const allDay=(dayOfWeek:number)=>setWindows((prior)=>[
    ...prior.filter((item)=>item.dayOfWeek!==dayOfWeek),
    {dayOfWeek,startLocalTime:'00:00',endLocalTime:'24:00'}]);
  const copyWeekdays=()=>setWindows((prior)=>{
    const monday=prior.filter((item)=>item.dayOfWeek===1);
    return [...prior.filter((item)=>item.dayOfWeek===1||item.dayOfWeek>5),
      ...[2,3,4,5].flatMap((dayOfWeek)=>monday.map((item)=>({...item,dayOfWeek})))];
  });
  const save=async()=>{
    setPending(true);setError(null);
    try{await request(`capability/${capability.id}/schedule`,{expectedRevision:operations.revision,
      policy:{...operations.policy,concurrencyLimit:concurrency,queueLimit:queue,schedule:{mode,timezone,
        weeklyWindows:mode==='CUSTOM_SCHEDULE'?windows:[]}}});
      setOpen(false);onSaved();}
    catch(cause){setError(cause instanceof Error?cause.message:'Could not save schedule');}
    finally{setPending(false);}
  };
  return <div className="ops-schedule"><div className="ops-schedule-preview"><strong>Next seven days</strong>
    <small>Seller local time · {operations.schedule.timezone}</small>
    <small>{operations.insideServiceHours?'Currently within service hours · ':''}{
      operations.nextWindow?`Next new window starts ${stamp(operations.nextWindow.startAt)}`:
      'No new execution window in the next 14 days'}</small>
    <div>{weekPreview(operations.schedule).map((day)=><span key={day.date}>
      <b>{day.date}</b>{day.hours}</span>)}</div></div>
    <button type="button" className="ops-link" onClick={()=>setOpen(!open)}
    aria-expanded={open}>Edit service hours and capacity</button>{open&&<div className="ops-editor">
    <p>New jobs start only inside the allowed windows. Running work continues when a window closes.
      Your computer must stay awake with the Worker connected for overnight jobs; Kivro does not wake it.</p>
    <label>Availability<select value={mode} onChange={(event)=>setMode(event.target.value as typeof mode)}>
      <option value="ALWAYS_AVAILABLE">Always available while Worker is ready</option>
      <option value="CUSTOM_SCHEDULE">Custom weekly windows</option></select></label>
    <label>Schedule timezone<input value={timezone} onChange={(event)=>setTimezone(event.target.value)}
      placeholder="Europe/Zurich" /></label>
    {mode==='CUSTOM_SCHEDULE'&&<div className="ops-days"><button type="button"
      onClick={copyWeekdays}>Copy Monday to weekdays</button>{dayNames.map((day,index)=><div key={day}>
      <strong>{day}</strong><div>{windows.filter((item)=>item.dayOfWeek===index+1).map((item,position)=><div
        className="ops-window" key={`${day}-${position}`}><input aria-label={`${day} start ${position+1}`}
          type="time" value={item.startLocalTime} onChange={(event)=>setWindows((prior)=>{
            const next=[...prior];const target=next.findIndex((entry,at)=>entry.dayOfWeek===index+1&&
              prior.slice(0,at).filter((other)=>other.dayOfWeek===index+1).length===position);
            if(target>=0)next[target]={...next[target]!,startLocalTime:event.target.value};return next;})}/>
        <span aria-hidden="true">to</span>{item.endLocalTime==='24:00'?<span>Midnight (all day)</span>:<input
          aria-label={`${day} end ${position+1}`} type="time" value={item.endLocalTime}
          onChange={(event)=>setWindows((prior)=>{
            const next=[...prior];const target=next.findIndex((entry,at)=>entry.dayOfWeek===index+1&&
              prior.slice(0,at).filter((other)=>other.dayOfWeek===index+1).length===position);
            if(target>=0)next[target]={...next[target]!,endLocalTime:event.target.value};return next;})}/>}
        <button type="button" onClick={()=>setWindows((prior)=>{
          let seen=-1;return prior.filter((entry)=>entry.dayOfWeek!==index+1||++seen!==position);})}
          aria-label={`Remove ${day} window ${position+1}`}>Remove</button></div>)}</div>
      <button type="button" disabled={windows.filter((item)=>item.dayOfWeek===index+1).length>=4}
        onClick={()=>add(index+1)}>Add window</button> <button type="button"
        onClick={()=>allDay(index+1)}>All day</button> <button type="button"
        onClick={()=>setWindows((prior)=>prior.filter((item)=>item.dayOfWeek!==index+1))}>
          Unavailable</button></div>)}</div>}
    <div className="ops-editor-actions"><label>Concurrent jobs<input type="number" min="1" max="64"
      value={concurrency} onChange={(event)=>setConcurrency(Number(event.target.value))}/></label>
      <label>Queue limit<input type="number" min="0" max="64"
        value={queue} onChange={(event)=>setQueue(Number(event.target.value))}/></label></div>
    {error&&<p role="alert" className="ops-error">{error}</p>}
    <button type="button" className="primary-button" disabled={pending} onClick={save}>
      {pending?'Saving…':'Save availability'}</button>
  </div>}</div>;
}

export default function OperationsDashboard({supportedOpenClawVersion}:{supportedOpenClawVersion:string}){
  const [data,setData]=useState<Dashboard|null>(null),[loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null),[busy,setBusy]=useState<string|null>(null);
  const [notice,setNotice]=useState<string|null>(null);
  const [maintenance,setMaintenance]=useState<Record<string,string>>({});
  const [reportCategories,setReportCategories]=useState<Record<string,string>>({});
  const load=useCallback(async()=>{
    try{const response=await fetch('/api/seller/operations/dashboard',{cache:'no-store'});
      if(!response.ok){const body=await response.json() as {code?:string};
        throw new Error(body.code??`LOAD_FAILED_${response.status}`);}
      setData(dashboardSchema.parse(await response.json()));setError(null);}
    catch(cause){setError(cause instanceof Error?cause.message:'Dashboard unavailable');}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();const timer=setInterval(()=>void load(),30_000);
    return ()=>clearInterval(timer);},[load]);
  const action=async(key:string,path:string,body:unknown)=>{
    setBusy(key);setError(null);setNotice(null);
    try{await request(path,body);await load();
      if(path==='report-abuse')setNotice('Safety report received for review.');}
    catch(cause){setError(cause instanceof Error?cause.message:'Control failed');}
    finally{setBusy(null);}
  };
  return <section className="ops" aria-labelledby="ops-title"><div className="ops-header">
    <div><p className="eyebrow">Seller operations</p><h2 id="ops-title">Your work, at a glance.</h2>
      <p>Cloud status may lag a disconnected Worker. Local emergency pause always stops new offers on your machine.</p></div>
    <button type="button" className="ops-link" onClick={()=>void load()}>Refresh status</button></div>
    {loading&&<p role="status">Loading operational state…</p>}
    {error&&<p role="alert" className="ops-error">{error}</p>}
    {notice&&<p role="status" className="notice success">{notice}</p>}
    {data&&<>
      <div className="ops-grid"><section className="ops-panel"><div className="ops-panel-head"><h3>Worker health</h3>
        <small>Heartbeat must be recent</small></div>{data.workers.length?data.workers.map((worker)=><article
          className="ops-row" key={worker.id}><div><strong>{worker.name}</strong>{' '}<span className={`ops-state ${worker.status.toLowerCase()}`}>{worker.status==='ONLINE'?'Online':worker.status==='OFFLINE'?'Offline':worker.status==='PAUSED'?'Paused':worker.status.replaceAll('_',' ').toLowerCase()}</span><p>{worker.platform} · Worker {worker.worker_version}
            {' · '}OpenClaw {worker.openclaw_version??'unknown'} ({
              worker.openclaw_compatibility==='APPROVED_PINNED'?'approved pinned runtime':
                'compatibility unconfirmed'})</p>
            <details className="ops-disclosure"><summary>View Worker diagnostics</summary>            <small>Latest Worker {worker.latestWorkerRelease??'unknown'} · Minimum {worker.minimumWorkerRelease??'unknown'}
              {' · '}{worker.versionStatus.replaceAll('_',' ').toLowerCase()}</small>
            <small>Supported isolated OpenClaw: {supportedOpenClawVersion} · {
              worker.openclaw_compatibility==='APPROVED_PINNED'? 'approved for execution':
                'no approved runtime reported; new work blocked'}</small>
            <small>Last success {stamp(worker.lastSuccessAt)} · Last failure {stamp(worker.lastFailureAt)}</small>
            <small>7 day average runtime {worker.average_runtime_seconds===null?'Unknown':
              `${Math.round(worker.average_runtime_seconds)} seconds`} · failure rate {
              worker.failure_rate===null?'Unknown':`${(worker.failure_rate*100).toFixed(1)}%`}</small>
            <small>Docker {worker.operational_checks?.find((check)=>check.code==='DOCKER_DAEMON')?.state??'Unknown'}
              {' · '}approved sandbox {worker.operational_checks?.find((check)=>
                check.code==='APPROVED_SANDBOX_IMAGE')?.state??'Unknown'}</small>
            </details>
            <small>Last heartbeat {stamp(worker.lastHeartbeatAt)}
              {' · '}{worker.running_jobs??'—'} running / {worker.capacity??'—'} capacity
              {' · '}{worker.pending_jobs} pending</small>
            {worker.cloudSyncPending&&<small role="status">Pause change awaiting Worker acknowledgement; new jobs blocked.</small>}
            {worker.maintenanceUntil&&<small>Maintenance scheduled to end {stamp(worker.maintenanceUntil)}; readiness must pass before jobs resume.</small>}
            {worker.warnings.map((warning)=><p className="ops-warning" role="alert" key={warning.code}>
              {warning.severity}: {warning.title}. {warning.description} {warning.action}
              {warning.detectedAt?` · Detected ${stamp(warning.detectedAt)}`:''}</p>)}</div>
          <div className="ops-row-actions">
            <button type="button" className={!worker.web_paused?'ops-safety-action':undefined} disabled={busy!==null} onClick={()=>void action(worker.id,
              `worker/${worker.id}/pause`,{paused:!worker.web_paused,reason:null})}>
              {busy===worker.id?'Updating…':worker.web_paused?'Resume new jobs':'Pause all new jobs'}</button>
            <label>Maintenance until<input type="datetime-local" value={maintenance[worker.id]??''}
              onChange={(event)=>setMaintenance((prior)=>({...prior,[worker.id]:event.target.value}))}/></label>
            <button type="button" disabled={busy!==null||!maintenance[worker.id]}
              onClick={()=>void action(worker.id,`worker/${worker.id}/pause`,{paused:true,
                reason:'Scheduled maintenance',maintenanceUntil:new Date(maintenance[worker.id]!).toISOString()})}>
              Schedule maintenance</button></div></article>):
          <p className="ops-empty">No paired Worker yet. Connect a Worker before publishing.</p>}</section>
      <section className="ops-panel"><div className="ops-panel-head"><h3>Capabilities</h3>
        <small>Each service has independent readiness</small></div>
        {data.capabilities.length?data.capabilities.map((capability)=><article className="ops-row"
          key={capability.id}><div><strong>{capability.name}</strong>
            {capability.price&&<p className="ops-price">{money(capability.price.buyerAmountMinor)} / job ·
              You earn {money(capability.price.sellerEarningMinor)} ·
              Marketplace fee {money(capability.price.platformFeeMinor)}</p>}
            <p>{capability.status==='PUBLISHED'?'Published':capability.status.replaceAll('_',' ').toLowerCase()} ·
            {capability.availability?availabilityLabel(capability.availability.status):'Not published'} ·
            {capability.availability?availabilityReasonLabel(capability.availability.reason):'No operational policy'}</p>
            {capability.availability?.nextAvailableAt&&<small>Next available {stamp(capability.availability.nextAvailableAt)}</small>}
            {capability.maintenanceUntil&&<small>Maintenance scheduled to end {stamp(capability.maintenanceUntil)}; readiness must pass first.</small>}
            <small>Isolation {capability.readinessFresh?
              capability.sandbox_verified===true?'ready':'blocked':'stale / unknown'} ·
              credentials {capability.readinessFresh?
                capability.required_secrets_ready===true?'ready':'blocked':'stale / unknown'} ·
              runtime {capability.readinessFresh?
                capability.runtime_healthy===true?'ready':'blocked':'stale / unknown'}</small>
            {capability.operations&&<small>{capability.operations.scheduledCount} scheduled ·
              {capability.operations.queuedCount} queued ·
              {capability.runningCount} running / {capability.operations.policy.concurrencyLimit} max</small>}
            {capability.permission_manifest&&<details className="ops-disclosure">
              <summary>View buyer-visible access for this version</summary>
              <p>The published version declares these access categories. Changing the underlying
                resource or permission requires a new reviewed version.</p>
              <div className="permission-grid">{capability.permission_manifest.entries.map((entry)=><div
                key={entry.category}><span>{permissionCategoryLabel(entry.category)}</span>
                <strong>{permissionStateLabel(entry.state)}</strong></div>)}</div>
            </details>}
            <details className="ops-disclosure"><summary>View availability history</summary>            {capability.availabilityMetrics&&<div className="ops-metrics">
              <strong>Availability observations</strong>
              <small>Last {capability.availabilityMetrics.periodDays} days, observed minutes:</small>
              <div className="ops-metrics-grid">
                <span><b>{capability.availabilityMetrics.onlineMinutesObserved}</b>Online</span>
                <span><b>{capability.availabilityMetrics.busyMinutesObserved}</b>Busy</span>
                <span><b>{capability.availabilityMetrics.offlineMinutesObserved}</b>Offline</span>
                <span><b>{capability.availabilityMetrics.unobservedMinutes}</b>Unobserved</span>
              </div>
              <small>{capability.availabilityMetrics.scheduledOfflineMinutesObserved} minutes
                outside service hours · {capability.availabilityMetrics.pausedMinutesObserved} paused ·
                {' '}{capability.availabilityMetrics.readinessBlockedMinutesObserved} readiness blocked.</small>
              <small>{capability.availabilityMetrics.jobsAccepted} jobs accepted ·
                {' '}{capability.availabilityMetrics.queueFullRejects} queue-full rejects ·
                {' '}median queue wait {capability.availabilityMetrics.medianQueueWaitSeconds===null?
                  'unknown':`${Math.round(capability.availabilityMetrics.medianQueueWaitSeconds)}s`} ·
                {' '}median execution {capability.availabilityMetrics.medianExecutionSeconds===null?
                  'unknown':`${Math.round(capability.availabilityMetrics.medianExecutionSeconds)}s`} ·
                {' '}{capability.availabilityMetrics.disconnectFailures} disconnect failures.</small>
              <small>Time is sampled once per minute; missing periods are unknown. These observations
                do not affect marketplace ranking.</small>
            </div>}
            </details>
            <small>Last success {stamp(capability.lastSuccessAt)} · Last failure {
              stamp(capability.lastFailureAt)}</small>
          </div><div className="ops-row-actions"><button type="button" className={!capability.operations?.sellerPaused?'ops-safety-action':undefined} disabled={busy!==null||!capability.operations}
            onClick={()=>void action(capability.id,`capability/${capability.id}/pause`,
              {paused:!capability.operations?.sellerPaused,reason:null})}>
            {capability.operations?.sellerPaused?'Resume capability':'Pause capability'}</button>
            <label>Maintenance until<input type="datetime-local" value={maintenance[capability.id]??''}
              onChange={(event)=>setMaintenance((prior)=>({...prior,[capability.id]:event.target.value}))}/></label>
            <button type="button" disabled={busy!==null||!maintenance[capability.id]||!capability.operations}
              onClick={()=>void action(capability.id,`capability/${capability.id}/pause`,{paused:true,
                reason:'Scheduled maintenance',maintenanceUntil:new Date(maintenance[capability.id]!).toISOString()})}>
              Schedule maintenance</button></div>
          <ScheduleEditor capability={capability} onSaved={()=>void load()}/></article>):
          <p className="ops-empty">No capabilities yet. Nothing is listed for buyers.</p>}</section></div>
      <div className="ops-summary"><div><span>Jobs today (UTC)</span><strong>{data.economicsSummary.jobsToday}</strong></div>
        <div><span>Jobs total</span><strong>{data.economicsSummary.jobsTotal}</strong></div>
        <div><span>Gross settled sales</span><strong>{money(data.settledSales.buyerSalesMinor)}</strong></div>
        <div><span>Marketplace fees</span><strong>{money(data.settledSales.marketplaceFeesMinor)}</strong></div>
        <div><span>Net marketplace earnings</span><strong>{money(data.settledSales.buyerSalesMinor-data.settledSales.marketplaceFeesMinor)}</strong></div>
        <div><span>Provider costs</span><strong>{money((data.economicsSummary.providerCosts.measuredMicroUsd+
          data.economicsSummary.providerCosts.estimatedMicroUsd)/10_000)}</strong>
          <small>{data.economicsSummary.providerCosts.measuredCalls} measured calls · {
            data.economicsSummary.providerCosts.estimatedCalls} estimated calls · {
            data.economicsSummary.providerCosts.unknownJobs} jobs with unknown cost</small></div>
        <div><span>Pending earnings</span><strong>{money(data.earnings.pendingMinor)}</strong></div>
        <div><span>Available</span><strong>{money(data.earnings.availableMinor)}</strong></div>
        <div><span>Transferred</span><strong>{money(data.earnings.transferredMinor)}</strong></div>
        <div><span>Paid out</span><strong>{money(data.earnings.paidOutMinor)}</strong></div>
        <div><span>Failure rate</span><strong>{data.economicsSummary.failureRate===null?'No completed attempts':
          `${(data.economicsSummary.failureRate*100).toFixed(1)}%`}</strong></div>
        <div><span>Average runtime</span><strong>{data.economicsSummary.averageRuntimeSeconds===null?
          'No completed attempts':`${Math.round(data.economicsSummary.averageRuntimeSeconds)}s`}</strong></div></div>
      <p className="ops-finance-note">Settled sales exclude refunded jobs. Earnings can change after a refund or payment dispute.</p>
      <section className="ops-panel ops-jobs"><div className="ops-panel-head"><h3>Jobs</h3>
        <small>Active work first, then recent history</small></div>
        {data.jobs.length?data.jobs.map((job)=><article className="ops-job" key={job.id}>
          <div><strong>{job.capability_name}</strong><p>#{job.id.slice(0,8)} · {jobStatusLabel(job.status)} ·
            payment {job.economics.paymentState}</p>
            <small>Buyer {money(job.economics.buyerPriceMinor)} · Kivro fee {
              money(job.economics.marketplaceFeeMinor)} · seller proceeds {
              money(job.economics.sellerProceedsMinor)}</small>
            <small>Provider cost {job.economics.providerCostMicroUsd===null?'Unknown':
              money(job.economics.providerCostMicroUsd/10_000)} ({
              job.economics.providerCostEvidence.replaceAll('_',' ').toLowerCase()})
              {' · '}Estimated net {job.economics.estimatedNetProceedsMinor===null?
                'Unknown':money(job.economics.estimatedNetProceedsMinor)}</small>
            {job.economics.possibleLoss&&<small className="ops-warning">Provider cost may exceed seller proceeds.</small>}
            <small>Created {stamp(job.created_at)}
              {job.started_at?` · Started ${stamp(job.started_at)}`:''}</small>
            <details><summary>Job audit</summary><ol>{job.audit.map((event,index)=><li key={`${event.at}-${index}`}>
              <time dateTime={event.at}>{stamp(event.at)}</time> · {event.kind} · {
                event.code.replaceAll('_',' ').toLowerCase()}</li>)}</ol></details></div>
          <div className="ops-row-actions">{job.status==='RUNNING'&&job.pause_support==='FULL_RESUME'&&
            <button type="button" disabled={busy!==null} onClick={()=>void action(job.id,
              `job/${job.id}/control`,{commandId:crypto.randomUUID(),jobId:job.id,
                executionId:job.execution_id,attemptId:job.attempt_id,
                controlPlaneId:job.control_plane_id,action:'PAUSE',reason:null,
                requestedAt:new Date().toISOString()})}>Pause job</button>}
            {job.status==='PAUSED'&&<button type="button" disabled={busy!==null}
              onClick={()=>{
                const worker=data.workers.find((item)=>item.id===job.worker_device_id);
                const override=!!worker?.web_paused||!!worker?.global_paused;
                if(override&&!window.confirm('The Worker is globally paused for new jobs. Resume this existing job anyway?'))return;
                void action(job.id,`job/${job.id}/control`,{commandId:crypto.randomUUID(),
                  jobId:job.id,executionId:job.execution_id,attemptId:job.attempt_id,
                  controlPlaneId:job.control_plane_id,action:'RESUME',reason:null,
                  overrideGlobalPause:override,requestedAt:new Date().toISOString()});}}>Resume job</button>}
            {job.status==='PAUSE_REQUESTED'&&<span className="ops-state">Pause requested…</span>}
            {job.pause_support!=='FULL_RESUME'&&job.status==='RUNNING'&&<small>
              {job.pause_support==='RESTART_STEP'?'Step restart pause is not yet available; cancel if urgent.':
                'Pause unavailable; cancel instead.'}</small>}
            {['STARTING','RUNNING','UPLOADING_RESULT','PAUSE_REQUESTED','PAUSED',
              'RESUME_REQUESTED','SECURITY_PAUSED'].includes(job.status)&&
              <button type="button" className="ops-danger-action" disabled={busy!==null} onClick={()=>{
                if(!window.confirm('Cancel this running job? Execution will stop. Undelivered work will be released to the buyer after Worker confirmation.'))return;
                void action(job.id,`job/${job.id}/control`,{commandId:crypto.randomUUID(),
                  jobId:job.id,executionId:job.execution_id,attemptId:job.attempt_id,
                  controlPlaneId:job.control_plane_id,action:'CANCEL',reason:null,
                  requestedAt:new Date().toISOString()});}}>Cancel job</button>}
            <label>Safety concern<select value={reportCategories[job.id]??'MALICIOUS_INPUT'}
              onChange={(event)=>setReportCategories((current)=>({...current,
                [job.id]:event.target.value}))}>
              <option value="MALICIOUS_INPUT">Malicious input</option><option value="HARASSMENT">Harassment</option>
              <option value="FRAUD">Fraud</option><option value="PRIVACY">Privacy</option>
              <option value="OTHER">Other</option></select></label>
            <button type="button" disabled={busy!==null} onClick={()=>void action(job.id,
              'report-abuse',{id:crypto.randomUUID(),jobId:job.id,
                category:reportCategories[job.id]??'MALICIOUS_INPUT'})}>Report unsafe job</button>
          </div></article>):<p className="ops-empty">No buyer jobs yet.</p>}</section>
      <section className="ops-panel ops-history"><div className="ops-panel-head"><h3>Recent health and controls</h3>
        <small>Sanitized operational history</small></div>{data.history.length?data.history.map((event,index)=><p
          key={`${event.worker_device_id}-${event.created_at}-${index}`}><time>{stamp(event.created_at)}</time>
          <strong>{event.kind.replaceAll('_',' ')}</strong><span>{event.code.replaceAll('_',' ')}</span></p>):
          <p className="ops-empty">No recent operational events.</p>}</section>
    </>}
  </section>;
}
