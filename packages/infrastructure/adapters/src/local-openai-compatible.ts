import {request as httpRequest} from 'node:http';
import {NetworkPolicyError} from '../../../policy-engine/src/public-destination.js';
import type {CompletionConnector,CompletionRequest} from
  '../../../application/src/completion-broker.js';

export function localModelEndpoint(raw:string):URL{
  let value:URL;
  try{value=new URL(raw);}catch{throw new NetworkPolicyError('NETWORK_POLICY_DENIED');}
  if(value.protocol!=='http:'||!value.port||value.pathname!=='/v1'||
    !['127.0.0.1','localhost','[::1]'].includes(value.hostname)||
    value.username||value.password||value.search||value.hash)
    throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
  return value;
}

/** Host-side local inference never exposes a loopback socket to the sandbox.
 * The connection is pinned to loopback, has no proxy/redirect and sends no key. */
export class LocalOpenAiCompatibleConnector implements CompletionConnector{
  readonly providerId:string;
  readonly local=true;
  private readonly endpoint:URL;
  constructor(providerId:string,endpoint:string){
    if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(providerId))
      throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
    this.providerId=providerId;
    this.endpoint=localModelEndpoint(endpoint);
  }
  async checkDestination():Promise<void>{
    const response=await this.request('GET','/v1/models',null,AbortSignal.timeout(5_000));
    if(!response||typeof response!=='object'||!('data' in response)||
      !Array.isArray(response.data))throw new NetworkPolicyError('BROKER_UNAVAILABLE');
  }
  async checkModel(modelId:string):Promise<void>{
    if(!modelId||modelId.length>160)
      throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
    const response=await this.request('GET','/v1/models',null,AbortSignal.timeout(5_000));
    const data=response!==null&&typeof response==='object'&&'data' in response?
      response.data:null;
    if(!Array.isArray(data)||data.length>512||!data.some((item)=>
      item!==null&&typeof item==='object'&&!Array.isArray(item)&&
      'id' in item&&item.id===modelId))
      throw new NetworkPolicyError('BROKER_UNAVAILABLE');
  }
  async complete(input:CompletionRequest,_credential:string,signal:AbortSignal):Promise<unknown>{
    if(signal.aborted||input.stream!==false)
      throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
    const body=Buffer.from(JSON.stringify(input));
    if(body.byteLength>1_048_576)throw new NetworkPolicyError('NETWORK_BUDGET_EXCEEDED');
    return this.request('POST','/v1/chat/completions',body,signal);
  }
  private async request(method:'GET'|'POST',path:string,body:Buffer|null,
    signal:AbortSignal):Promise<unknown>{
    const hostname=this.endpoint.hostname==='[::1]'?'::1':'127.0.0.1';
    return new Promise((resolve,reject)=>{
      const req=httpRequest({hostname,port:Number(this.endpoint.port),method,path,signal,
        timeout:method==='GET'?5_000:30_000,
        headers:{accept:'application/json',...(body?{'content-type':'application/json',
          'content-length':body.byteLength}:{})}},(res)=>{
        const type=res.headers['content-type']?.split(';',1)[0]?.trim().toLowerCase();
        if(res.statusCode!==200||type!=='application/json'||
          res.headers['content-length']&&Number(res.headers['content-length'])>2_097_152){
          res.resume();reject(new NetworkPolicyError('BROKER_UNAVAILABLE'));return;
        }
        const chunks:Buffer[]=[];let size=0;
        res.on('data',(chunk:Buffer)=>{
          size+=chunk.byteLength;
          if(size>2_097_152){req.destroy(new NetworkPolicyError('NETWORK_BUDGET_EXCEEDED'));return;}
          chunks.push(chunk);
        });
        res.on('end',()=>{
          try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown);}
          catch{reject(new NetworkPolicyError('BROKER_UNAVAILABLE'));}
        });
      });
      req.on('timeout',()=>req.destroy(new NetworkPolicyError('BROKER_UNAVAILABLE')));
      req.on('error',()=>reject(new NetworkPolicyError('BROKER_UNAVAILABLE')));
      req.end(body??undefined);
    });
  }
}
