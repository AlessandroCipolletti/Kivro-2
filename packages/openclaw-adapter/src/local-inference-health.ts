import type { DiscoveredLocalInferenceCandidate } from './read-only-discovery.js';

export interface LocalInferenceHealth {
  readonly state:'READY'|'NOT_READY';
  readonly latencyMs:number|null;
  readonly checkedAt:string;
}

/** A bounded, read-only model inventory probe. It never invokes personal
 * OpenClaw commands, starts a model, supplies a credential or follows redirects. */
export async function checkLocalInferenceHealth(candidate:DiscoveredLocalInferenceCandidate,
  fetcher:typeof fetch=fetch):Promise<LocalInferenceHealth>{
  const checkedAt=new Date().toISOString();
  const failed={state:'NOT_READY' as const,latencyMs:null,checkedAt};
  let endpoint:URL;
  try{endpoint=new URL(candidate.endpoint);}
  catch{return failed;}
  if(endpoint.protocol!=='http:'||!endpoint.port||endpoint.pathname!=='/v1'||
    !['127.0.0.1','localhost','[::1]'].includes(endpoint.hostname)||
    endpoint.username||endpoint.password||endpoint.search||endpoint.hash)return failed;
  const started=performance.now();
  try{
    const response=await fetcher(new URL('/v1/models',endpoint),{
      method:'GET',redirect:'manual',signal:AbortSignal.timeout(5_000),
      headers:{accept:'application/json'},
    });
    if(response.status!==200||!response.body||
      !response.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
      return failed;
    const length=response.headers.get('content-length');
    if(length!==null&&Number(length)>65_536)return failed;
    const reader=response.body.getReader();
    const chunks:Uint8Array[]=[];
    let bytes=0;
    while(true){
      const part=await reader.read();
      if(part.done)break;
      bytes+=part.value.byteLength;
      if(bytes>65_536){await reader.cancel();return failed;}
      chunks.push(part.value);
    }
    const parsed=JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
    const data=parsed!==null&&typeof parsed==='object'&&!Array.isArray(parsed)&&
      'data' in parsed?parsed.data:null;
    if(!Array.isArray(data)||data.length>512||!data.some((item)=>
      item!==null&&typeof item==='object'&&!Array.isArray(item)&&
      'id' in item&&item.id===candidate.model))return failed;
    return {state:'READY',latencyMs:Math.max(0,Math.round(performance.now()-started)),checkedAt};
  }catch{return failed;}
}
