'use client';
import Link from 'next/link';
import { useCallback,useEffect,useRef,useState } from 'react';
import type { AgentPlan,AgentFinalResult,BuyerAgentConstraints } from '../../../../packages/contracts/src/marketplace-agent.js';
import { money,availabilityLabel,jobStatusLabel } from '../discover/marketplace-ui';

type Recommendation={capabilityId:string;capabilityVersionId:string;slug:string;name:string;
  sellerId:string;priceMinor:number;rating:number|null;reviewCount:number;
  availability:string;nextAvailableAt:string|null;typicalRuntimeSeconds:number|null;
  executionEligible:boolean;why:string[];limitations:string[]};
type Discovery={intent:{goal:string;missingInformation:string[]};constraints:BuyerAgentConstraints;
  recommendations:Recommendation[];missingInformation:string[]};
type Proposal={plan:AgentPlan;estimatedCompletionSeconds:number|null;repairedSteps:string[]};
type PlanView={plan:AgentPlan;finalResult:AgentFinalResult|null;spentMinor:number;reservedMinor:number;
  jobs:{stepId:string;jobId:string;status:string;paymentState:string|null}[];
  stepPermissions:{stepId:string;entries:{category:string;state:string}[]}[]};
type PriorPlan={id:string;goal:string;status:string;maxBudgetMinor:number;createdAt:string};
type OwnedAsset={id:string;fileName:string;mimeType:string;sizeBytes:number};
type ReplanOption={stepId:string;options:{capabilityId:string;name:string;slug:string;
  priceMinor:number;availability:string}[]};

async function agent<T>(path:string,body?:unknown):Promise<T>{
  const response=await fetch(`/api/agent/${path}`,body===undefined?{cache:'no-store'}:{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const result=await response.json() as T&{code?:string};
  if(!response.ok)throw new Error(result.code??'REQUEST_FAILED');
  return result;
}
function readable(code:string):string{return ({UNAVAILABLE:'Platform inference is unavailable right now. Browse the marketplace while it recovers.',
  PROVIDER_UNAVAILABLE:'The inference provider is temporarily unavailable. No purchase was made.',
  MISSING_INFORMATION:'The plan needs more information or an explicit budget before it can be checked.',
  STALE_PLAN:'Price, availability or service version changed. Prepare a fresh plan before approval.',
  INVALID_OUTPUT:'The proposed response could not be safely verified. Try clarifying your request.',
  BUDGET_EXCEEDED:'The request or plan exceeds an enforced budget.',
  NOT_ELIGIBLE:'Accept the marketplace terms and check your credits before approval.',
  INSUFFICIENT_CREDITS:'Add enough Kivro Credits before authorizing the plan.'} as Record<string,string>)[code]??code;}

export function AgentPanel({initialCapabilityId,initialPlanId}:{initialCapabilityId:string|null;
  initialPlanId:string|null}){
  const [request,setRequest]=useState('');const [budget,setBudget]=useState('');
  const [rating,setRating]=useState('');const [onlineOnly,setOnlineOnly]=useState(false);
  const [perJobBudget,setPerJobBudget]=useState('');const [maxMinutes,setMaxMinutes]=useState('');
  const [maxJobs,setMaxJobs]=useState('');
  const [noInternet,setNoInternet]=useState(false);const [noBrowser,setNoBrowser]=useState(false);
  const [timing,setTiming]=useState<'IMMEDIATE'|'EARLIEST_AVAILABLE_ALLOWED'|'DEADLINE'>('IMMEDIATE');
  const [deadline,setDeadline]=useState('');const [discovery,setDiscovery]=useState<Discovery|null>(null);
  const [selected,setSelected]=useState<string[]>(initialCapabilityId?[initialCapabilityId]:[]);
  const [conversationId,setConversationId]=useState<string|null>(null);
  const [proposal,setProposal]=useState<Proposal|null>(null);
  const [view,setView]=useState<PlanView|null>(null);
  const [plans,setPlans]=useState<PriorPlan[]>([]);const [ownedAssets,setOwnedAssets]=useState<OwnedAsset[]>([]);
  const [chosenAssets,setChosenAssets]=useState<string[]>([]);const [draftId,setDraftId]=useState<string|null>(null);
  const [draftCapability,setDraftCapability]=useState<string|null>(null);
  const [draftMissing,setDraftMissing]=useState<string[]>([]);
  const [replanOptions,setReplanOptions]=useState<ReplanOption[]>([]);
  const [replanChoices,setReplanChoices]=useState<Record<string,string>>({});
  const [terms,setTerms]=useState(false);const [busy,setBusy]=useState('');
  const [error,setError]=useState('');const approvalId=useRef<string|null>(null);
  const parsedBudget=Math.round(Number(budget)*100);
  const parsedPerJob=Math.round(Number(perJobBudget)*100);
  const constraints=():BuyerAgentConstraints=>({
    ...(budget.trim()&&Number.isSafeInteger(parsedBudget)&&parsedBudget>0?
      {maxTotalSpendMinor:parsedBudget}:{}),
    ...(rating?{minRating:Number(rating)}:{}),onlineOnly,
    ...(perJobBudget.trim()&&Number.isSafeInteger(parsedPerJob)&&parsedPerJob>0?
      {maxPerJobSpendMinor:parsedPerJob}:{}),
    ...(maxMinutes.trim()&&Number.isSafeInteger(Number(maxMinutes))&&Number(maxMinutes)>0?
      {maxRuntimeSeconds:Number(maxMinutes)*60}:{}),
    ...(maxJobs.trim()&&Number.isSafeInteger(Number(maxJobs))&&Number(maxJobs)>0?
      {maxJobs:Number(maxJobs)}:{}),
    permissionLimits:[...(noInternet?[{category:'PUBLIC_INTERNET' as const,
      allowedStates:['NOT_USED' as const]}]:[]),...(noBrowser?[{category:'BROWSER' as const,
      allowedStates:['NOT_USED' as const]}]:[])],
    outputTypes:[],requiredInputTypes:[],blockedSellerIds:[],preferredCapabilityIds:[],
    timing:timing==='DEADLINE'?
      {mode:'DEADLINE',maxQueueWaitSeconds:604800,
        deadlineAt:deadline?new Date(deadline).toISOString():new Date(0).toISOString()}:
      timing==='EARLIEST_AVAILABLE_ALLOWED'?
        {mode:'EARLIEST_AVAILABLE_ALLOWED',maxQueueWaitSeconds:604800}:
        {mode:'IMMEDIATE',maxQueueWaitSeconds:0},
  });
  const refreshView=useCallback(async(id:string)=>{
    const result=await agent<PlanView>(`plan/${id}`);setView(result);return result;
  },[]);
  useEffect(()=>{
    void Promise.all([agent<{items:PriorPlan[]}>('plans'),
      agent<{items:OwnedAsset[]}>('owned-assets')]).then(([history,assets])=>{
      setPlans(history.items);setOwnedAssets(assets.items);
    }).catch(()=>{/* Browsing and form remain available. */});
    if(initialPlanId)void refreshView(initialPlanId).catch(()=>setError('Could not load that plan.'));
  },[initialPlanId,refreshView]);
  useEffect(()=>{
    if(!view||!['RUNNING','CANCELLING'].includes(view.plan.status))return;
    const timer=window.setInterval(()=>{void refreshView(view.plan.id).catch(()=>{});},15000);
    return ()=>window.clearInterval(timer);
  },[view,refreshView]);
  useEffect(()=>{
    if(!view||view.plan.status!=='AWAITING_REAPPROVAL')return;
    void agent<{items:ReplanOption[]}>(`replan-options/${view.plan.id}`).then((result)=>{
      setReplanOptions(result.items);
      setReplanChoices(Object.fromEntries(result.items.map((item)=>[
        item.stepId,item.options.find((option)=>option.capabilityId===
          view.plan.steps.find((step)=>step.id===item.stepId)?.capabilityId)?.capabilityId??
          item.options[0]?.capabilityId??''])));
    }).catch(()=>setError('Could not load current replacement options. Refresh the plan.'));
  },[view]);
  const discover=async()=>{
    setError('');setBusy('discover');setProposal(null);setView(null);setDraftId(null);
    try{
      const id=conversationId??crypto.randomUUID();setConversationId(id);
      const result=await agent<Discovery>('discover',{conversationId:id,messageId:crypto.randomUUID(),
        request:`${request}${noInternet?' Without public internet.':''}${noBrowser?' No browser access.':''}`,
        constraints:constraints()});
      setDiscovery(result);setTiming(result.constraints.timing.mode);
      setSelected((old)=>old.filter((id)=>result.recommendations.some((item)=>
        item.capabilityId===id&&item.executionEligible)));
    }catch(cause){setError(readable(cause instanceof Error?cause.message:'REQUEST_FAILED'));}
    finally{setBusy('');}
  };
  const prepareDraft=async(item:Recommendation)=>{
    if(!conversationId)return;
    setBusy(`draft:${item.capabilityId}`);setError('');
    try{const response=await agent<{draftId:string;draft:{missingFieldKeys:string[]}}>('draft',{
      conversationId,capabilityId:item.capabilityId,request,ownedAssetIds:chosenAssets});
      setDraftId(response.draftId);setDraftCapability(item.capabilityId);
      setDraftMissing(response.draft.missingFieldKeys);
    }catch(cause){setError(readable(cause instanceof Error?cause.message:'REQUEST_FAILED'));}
    finally{setBusy('');}
  };
  const preparePlan=async()=>{
    if(!conversationId||!discovery)return;
    setBusy('plan');setError('');
    try{
      if(!budget||!Number.isSafeInteger(parsedBudget)||parsedBudget<1)
        throw new Error('Enter a maximum total spend before preparing a paid plan.');
      const result=await agent<Proposal>('plan',{conversationId,goal:request,
        constraints:{...discovery.constraints,...constraints(),
          outputTypes:discovery.constraints.outputTypes,
          requiredInputTypes:discovery.constraints.requiredInputTypes,
          maxTotalSpendMinor:Math.min(parsedBudget,discovery.constraints.maxTotalSpendMinor??parsedBudget)},
        candidateIds:selected.length?selected:discovery.recommendations.filter((item)=>
          item.executionEligible).slice(0,8).map((item)=>item.capabilityId),
        ownedAssetIds:chosenAssets});
      setProposal(result);await refreshView(result.plan.id);
    }catch(cause){setError(readable(cause instanceof Error?cause.message:'REQUEST_FAILED'));}
    finally{setBusy('');}
  };
  const approve=async()=>{
    const current=view?.plan??proposal?.plan;if(!current)return;
    setBusy('approve');setError('');
    try{
      if(!terms)throw new Error('Read and accept the marketplace terms before approval.');
      await fetch('/api/marketplace/terms',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({acceptanceId:crypto.randomUUID(),version:1,accepted:true})}).then(async(response)=>{
          if(!response.ok)throw new Error((await response.json() as {code?:string}).code??'TERMS_FAILED');
        });
      approvalId.current??=crypto.randomUUID();
      await agent('approve',{planId:current.id,approvalId:approvalId.current});
      await refreshView(current.id);
    }catch(cause){
      try{
        const recovered=await refreshView(current.id);
        if(!['AWAITING_APPROVAL','DRAFT'].includes(recovered.plan.status))return;
      }catch{/* Preserve the original error. */}
      setError(readable(cause instanceof Error?cause.message:'REQUEST_FAILED'));
    }
    finally{setBusy('');}
  };
  const cancel=async()=>{
    if(!view)return;setBusy('cancel');setError('');
    try{await agent('cancel',{planId:view.plan.id});await refreshView(view.plan.id);}
    catch(cause){setError(readable(cause instanceof Error?cause.message:'REQUEST_FAILED'));}
    finally{setBusy('');}
  };
  const replan=async()=>{
    if(!view)return;setBusy('replan');setError('');
    try{
      await agent('replan',{planId:view.plan.id,choices:replanOptions.map((item)=>({
        stepId:item.stepId,capabilityId:replanChoices[item.stepId]}))});
      approvalId.current=null;
      setProposal(null);
      await refreshView(view.plan.id);
    }catch(cause){setError(readable(cause instanceof Error?cause.message:'REQUEST_FAILED'));}
    finally{setBusy('');}
  };
  const toggle=(id:string)=>setSelected((old)=>old.includes(id)?old.filter((item)=>item!==id):
    old.length>=8?old:[...old,id]);
  return <div className="ai-layout"><section className="ai-workspace" aria-label="Marketplace Agent workspace">
    <div className="ai-step-heading"><span>01</span><div><p className="form-eyebrow">YOUR REQUEST</p><h2>What should be done?</h2></div></div>
    <label className="ai-label" htmlFor="ai-request-text">Describe the outcome, available inputs and any hard limits.</label>
    <textarea id="ai-request-text" rows={5} value={request} onChange={(event)=>setRequest(event.target.value)}
      placeholder="Example: Summarize my uploaded research notes into a brief report. Spend no more than $10. Do not use public internet."/>
    <div className="ai-controls"><label>Maximum total spend, USD<input type="number" min="0.01" max="10000" step="0.01" value={budget} onChange={(event)=>setBudget(event.target.value)} placeholder="Required for paid plans"/></label>
      <label>Minimum verified rating<select value={rating} onChange={(event)=>setRating(event.target.value)}><option value="">Any</option><option>3</option><option>4</option><option>4.5</option></select></label>
      <label>Timing<select value={timing} onChange={(event)=>setTiming(event.target.value as typeof timing)}><option value="IMMEDIATE">Available now</option><option value="EARLIEST_AVAILABLE_ALLOWED">Future windows allowed</option><option value="DEADLINE">Start before a deadline</option></select></label>
      <label>Maximum per service, USD<input type="number" min="0.01" max="10000" step="0.01" value={perJobBudget} onChange={(event)=>setPerJobBudget(event.target.value)} placeholder="Optional"/></label>
      <label>Maximum typical runtime, minutes<input type="number" min="1" max="1440" step="1" value={maxMinutes} onChange={(event)=>setMaxMinutes(event.target.value)} placeholder="Optional"/></label>
      <label>Maximum paid jobs<input type="number" min="1" max="16" step="1" value={maxJobs} onChange={(event)=>setMaxJobs(event.target.value)} placeholder="Optional"/></label>
      {timing==='DEADLINE'&&<label>Latest acceptable start<input type="datetime-local" value={deadline} onChange={(event)=>setDeadline(event.target.value)}/></label>}</div>
    <div className="ai-checks"><label><input type="checkbox" checked={onlineOnly} onChange={(event)=>setOnlineOnly(event.target.checked)}/> Online sellers only</label><label><input type="checkbox" checked={noInternet} onChange={(event)=>setNoInternet(event.target.checked)}/> No public internet</label><label><input type="checkbox" checked={noBrowser} onChange={(event)=>setNoBrowser(event.target.checked)}/> No browser access</label></div>
    <p className="ai-footnote">Your request text and the minimum public marketplace data needed may be processed by Kivro’s configured third-party AI provider. File bytes are not sent to platform inference. Avoid putting secrets in this request. <Link href="/privacy">Read the privacy notice</Link></p>
    <button className="primary-button" disabled={!!busy||request.trim().length<4||timing==='DEADLINE'&&!deadline} onClick={discover}>{busy==='discover'?'Checking current marketplace…':'Find matching services'}</button>
    {error&&<p className="notice error" role="alert">{error}</p>}
    {discovery&&<section className="ai-discovery" aria-live="polite"><div className="ai-step-heading"><span>02</span><div><p className="form-eyebrow">CURRENT PUBLIC SERVICES</p><h2>Compare your options</h2></div></div>
      {discovery.missingInformation.length>0&&<div className="ai-uncertainty"><strong>Clarify before buying</strong><ul>{discovery.missingInformation.map((item,index)=><li key={index}>{item}</li>)}</ul></div>}
      {discovery.recommendations.length===0?<p className="ai-empty">No current public service satisfies every enforced limit. Adjust the request or browse the marketplace.</p>:
        <div className="ai-results">{discovery.recommendations.map((item)=><article key={item.capabilityId} className="ai-result"><div className="ai-result-top"><label><input type="checkbox" checked={selected.includes(item.capabilityId)} disabled={!item.executionEligible} onChange={()=>toggle(item.capabilityId)}/> {item.executionEligible?'Include in plan':'Advice only for current timing'}</label><span>{availabilityLabel(item.availability)}</span></div><h3><Link href={`/capabilities/${item.slug}`}>{item.name}</Link></h3><p className="ai-reason">{item.why.join(' · ')}</p><div className="ai-result-facts"><strong>{money(item.priceMinor)}</strong><span>{item.rating===null?'No verified rating yet':`${item.rating.toFixed(1)} stars · ${item.reviewCount} reviews`}</span><span>{item.typicalRuntimeSeconds===null?'Runtime unknown':`Typical run ${Math.max(1,Math.round(item.typicalRuntimeSeconds/60))} min`}</span></div>{item.limitations.length>0&&<p className="ai-limits">Limits: {item.limitations.slice(0,2).join(' · ')}</p>}<button className="ai-text-action" disabled={!!busy} onClick={()=>prepareDraft(item)}>{busy===`draft:${item.capabilityId}`?'Preparing inputs…':'Prepare inputs for this service'}</button>{draftCapability===item.capabilityId&&draftId&&<p className="ai-draft-ready">{draftMissing.length?`Still needed: ${draftMissing.join(', ')}. `:'Review every prepared field. '}<Link href={`/capabilities/${item.slug}?agentDraft=${draftId}#run-title`}>Open prepared job</Link></p>}</article>)}</div>}
      {discovery.recommendations.length>0&&!discovery.recommendations.some((item)=>item.executionEligible)&&<p className="ai-uncertainty">No matching service can run under the selected timing policy. You can review future options above, or explicitly allow future windows and search again.</p>}
      {ownedAssets.length>0&&<div className="ai-owned-assets"><strong>Your existing private uploads</strong><p>Select only files you want the agent to map. File bytes are not sent to platform inference.</p>{ownedAssets.map((asset)=><label key={asset.id}><input type="checkbox" checked={chosenAssets.includes(asset.id)} onChange={()=>setChosenAssets((old)=>old.includes(asset.id)?old.filter((id)=>id!==asset.id):[...old,asset.id])}/>{asset.fileName} <small>{asset.mimeType}</small></label>)}</div>}
      <button className="primary-button" disabled={!!busy||!discovery.recommendations.some((item)=>item.executionEligible)||!budget} onClick={preparePlan}>{busy==='plan'?'Validating service graph…':'Prepare a paid plan'}</button>
      <p className="ai-footnote">Planning does not reserve credits. Every selected step is checked against current published contracts, permissions, availability and your maximum spend.</p></section>}
    {view&&<section className="ai-plan" aria-live="polite"><div className="ai-step-heading"><span>03</span><div><p className="form-eyebrow">BUYER AUTHORIZATION</p><h2>Review the plan</h2></div></div>
      <div className="ai-plan-total"><div><span>Quoted service total</span><strong>{money(view.plan.quotedTotalMinor)}</strong></div><div><span>Hard authorization ceiling</span><strong>{money(view.plan.maxBudgetMinor)}</strong></div><div><span>Settled / reserved</span><strong>{money(view.spentMinor)} / {money(view.reservedMinor)}</strong></div></div>
      <p className="ai-footnote">{proposal?.plan.id===view.plan.id&&proposal.estimatedCompletionSeconds!==null&&view.plan.status==='AWAITING_APPROVAL'?`Historical runtime suggests about ${Math.ceil(proposal.estimatedCompletionSeconds/60)} minutes after admission. Queue or Worker delays are not included; this is not a deadline.`:'A reliable completion estimate is not available. Start eligibility and quote expiry for each step appear below.'}</p>
      <ol className="ai-plan-steps">{view.plan.steps.map((step,index)=>{const job=view.jobs.find((entry)=>entry.stepId===step.id);const permissions=view.stepPermissions.find((item)=>item.stepId===step.id)?.entries??[];return <li key={step.id}><div><strong>{index+1}. <Link href={`/capabilities/${step.slugSnapshot}`}>{step.nameSnapshot}</Link></strong><span>{money(step.quotedPriceMinor)} · {job?jobStatusLabel(job.status):step.status.replaceAll('_',' ').toLowerCase()}</span></div><small>{step.dependsOn.length?`After ${step.dependsOn.length} prerequisite result(s)`:'No prerequisite jobs'} · {step.availabilityStatusAtQuote==='ONLINE'?'Available at quote':`Quoted ${availabilityLabel(step.availabilityStatusAtQuote)}`} · earliest eligible {new Date(step.earliestEligibleAt).toLocaleString()} · quote expires {new Date(step.quoteExpiresAt).toLocaleString()}</small><small>{permissions.length?`Declared access: ${permissions.map((item)=>`${item.category.replaceAll('_',' ').toLowerCase()} (${item.state.replaceAll('_',' ').toLowerCase()})`).join(' · ')}`:'Declared access: no optional external resources'}. <Link href={`/capabilities/${step.slugSnapshot}`}>Read full permissions and trust terms</Link></small><details className="ai-step-inputs"><summary>Review inputs and data flow</summary><dl>{Object.entries(step.inputValues).map(([key,value])=><div key={`value:${key}`}><dt>{key}</dt><dd>{typeof value==='string'?value:JSON.stringify(value)}</dd></div>)}{Object.entries(step.inputAssets).map(([key,ids])=><div key={`asset:${key}`}><dt>{key}</dt><dd>{ids.map((id)=>ownedAssets.find((asset)=>asset.id===id)?.fileName??`Private file ${id}`).join(', ')}</dd></div>)}{step.mappings.map((mapping)=><div key={`${mapping.sourceStepId}:${mapping.sourceOutputKey}:${mapping.targetInputKey}`}><dt>{mapping.targetInputKey}</dt><dd>From {view.plan.steps.find((source)=>source.id===mapping.sourceStepId)?.nameSnapshot??'prerequisite job'} output “{mapping.sourceOutputKey}” after its validated result</dd></div>)}</dl>{!Object.keys(step.inputValues).length&&!Object.keys(step.inputAssets).length&&!step.mappings.length&&<p>No supplied inputs.</p>}</details>{job&&<Link href={`/buyer/jobs/${job.jobId}`}>View job · {jobStatusLabel(job.status)}</Link>}</li>;})}</ol>
      {view.plan.status==='AWAITING_APPROVAL'&&<><p className="ai-plan-warning">No paid execution starts until you approve. Prices, availability, service versions and input contracts are checked again before each reservation. If terms change, the plan pauses.</p><label className="run-terms"><input type="checkbox" checked={terms} onChange={(event)=>setTerms(event.target.checked)}/> I reviewed this plan and accept the <Link href="/marketplace-terms" target="_blank">Marketplace use terms</Link>.</label><button className="primary-button" disabled={!!busy||!terms} onClick={approve}>{busy==='approve'?'Authorizing…':`Approve plan, up to ${money(view.plan.maxBudgetMinor)}`}</button></>}
      {['RUNNING','CANCELLING'].includes(view.plan.status)&&<><p className="ai-plan-warning">Jobs and results persist if you close this page. This page refreshes authoritative status; there is no estimated completion time without reliable history.</p><button className="ai-text-action" onClick={()=>void refreshView(view.plan.id)}>Refresh status</button><button className="ai-text-action" disabled={!!busy} onClick={cancel}>{busy==='cancel'?'Requesting cancellation…':'Cancel remaining work'}</button></>}
      {view.plan.status==='AWAITING_REAPPROVAL'&&<div className="ai-uncertainty"><strong>Remaining work is paused</strong><p>A price, availability, version or funding prerequisite changed. Completed jobs and their charges remain visible above. Choose current eligible services for each remaining step; Kivro will show fresh terms before any new approval or purchase.</p>{replanOptions.map((item)=><label key={item.stepId} className="ai-replan-choice">{view.plan.steps.find((step)=>step.id===item.stepId)?.nameSnapshot??'Remaining step'}<select value={replanChoices[item.stepId]??''} onChange={(event)=>setReplanChoices((old)=>({...old,[item.stepId]:event.target.value}))}><option value="">{item.options.length?'Select a service':'No eligible equivalent service'}</option>{item.options.map((option)=><option key={option.capabilityId} value={option.capabilityId}>{option.name} · {money(option.priceMinor)} · {availabilityLabel(option.availability)}</option>)}</select></label>)}<button className="primary-button" disabled={!!busy||!replanOptions.length||replanOptions.some((item)=>!replanChoices[item.stepId])} onClick={replan}>{busy==='replan'?'Checking current terms…':'Review revised plan'}</button>{replanOptions.some((item)=>!item.options.length)&&<p>No equivalent service currently satisfies the hard constraints and timing policy. You can cancel remaining work or return later.</p>}</div>}
      {view.plan.status==='COMPLETED'&&<p className="notice success">All planned jobs completed with validated results. Open each job above for private deliverables and provenance.</p>}
      {view.finalResult&&<div className="ai-final-result"><p className="form-eyebrow">FINAL RESULT · SOURCE PROVENANCE</p><h3>Work delivered by {view.finalResult.jobs.length} marketplace service{view.finalResult.jobs.length===1?'':'s'}.</h3><p>The final deliverable is available from the final job{view.finalResult.finalJobIds.length===1?'':'s'} below. Source jobs and their individual results remain in My Jobs.</p><div className="ai-final-links">{view.finalResult.finalJobIds.map((jobId)=><Link key={jobId} href={`/buyer/jobs/${jobId}`}>Open final result and files</Link>)}</div><p>Settled service spend: {money(view.finalResult.spentMinor)} · unused authorization: {money(view.finalResult.unusedAuthorizationMinor)}. No credit was reserved for the unused portion.</p></div>}
      {view.plan.status==='FAILED'&&<p className="notice error">The plan stopped after a failed step. Completed jobs remain accessible above; unstarted steps were not purchased. Another job already running in a parallel branch may still finish and be charged under its own terms. Its current status and cancellation options are on its job page.</p>}
      {view.plan.status==='CANCELLED'&&<p className="notice success">No further jobs will start. Check each job above for its authoritative cancellation and credit status.</p>}
    </section>}
  </section><aside className="ai-aside"><div className="ai-aside-card"><span className="form-eyebrow">HOW AUTHORIZATION WORKS</span><h2>You stay in control.</h2><p>The model suggests services and inputs. Kivro Core verifies current facts and contracts. Only your approval can create paid reservations.</p><ul><li>Maximum spend is locked in the approved plan.</li><li>Credits are reserved before any paid job can execute.</li><li>Private files go only to authorized jobs.</li><li>Every job and result stays in My Jobs.</li></ul><Link href="/discover">Browse without AI</Link></div>{plans.length>0&&<div className="ai-history"><h3>Recent plans</h3>{plans.slice(0,8).map((item)=><Link key={item.id} href={`/ai-request?planId=${item.id}`}><strong>{item.goal}</strong><span>{item.status.replaceAll('_',' ')} · ceiling {money(item.maxBudgetMinor)}</span></Link>)}</div>}</aside></div>;
}
