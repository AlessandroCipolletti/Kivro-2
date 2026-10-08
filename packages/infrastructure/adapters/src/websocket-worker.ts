import {randomUUID} from 'node:crypto';
import WebSocket from 'ws';
import {z} from 'zod';
import {canonicalJson} from '../../../contracts/src/canonical-json.js';
import {workerMessageHash,workerSignatureBytes} from '../../../worker-protocol/src/auth.js';
import {JobAcceptedSchema,JobOfferSchema,WorkerHeartbeatSchema,WorkerHelloSchema,
  WorkerJobControlAckSchema,WorkerJobControlCommandSchema,WorkerWelcomeSchema,
  WorkerLocalJobControlReportSchema,WORKER_PROTOCOL_VERSION} from
  '../../../worker-protocol/src/messages.js';
import {WorkerCapabilityReviewSchema} from '../../../contracts/src/seller-publication.js';
import type {WorkerRpcTransport} from '../../../worker-protocol/src/transport.js';
import {WorkerJobRpcError,WorkerPollingError,type WorkerMessageSigner} from
  '../../netsons/src/https-polling.js';

const response=z.strictObject({id:z.uuid(),status:z.number().int().min(200).max(599),
  body:z.unknown().optional()});
const pollResponse=z.strictObject({protocolVersion:z.literal(WORKER_PROTOCOL_VERSION),
  messages:z.array(z.union([WorkerWelcomeSchema,JobOfferSchema,
    WorkerJobControlCommandSchema])).max(32)});
const outbound=z.union([WorkerHeartbeatSchema,JobAcceptedSchema,
  WorkerJobControlAckSchema,WorkerLocalJobControlReportSchema,WorkerCapabilityReviewSchema]);
const rpcDenial=z.strictObject({code:z.enum(['PAYMENT_NOT_SECURED','NOT_ELIGIBLE',
  'WRONG_WORKER','WRONG_CONTROL_PLANE','INVALID_LEASE','LEASE_EXPIRED','CONFLICT',
  'PAUSE_PENDING','SOURCE_UNAVAILABLE'])});
type Pending={resolve:(value:unknown)=>void;reject:(error:unknown)=>void;timer:NodeJS.Timeout};

/** Outbound WSS channel. Every frame remains independently device-signed;
 * connection state can disappear without changing execution ownership. */
export class WebSocketWorkerTransport implements WorkerRpcTransport {
  readonly kind='WEBSOCKET' as const;
  readonly supportedProtocolVersions=[WORKER_PROTOCOL_VERSION];
  private socket:WebSocket|null=null;
  private connecting:Promise<WebSocket>|null=null;
  private readonly pending=new Map<string,Pending>();
  private liveness:NodeJS.Timeout|null=null;
  private pongSeen=true;
  private closed=false;

  constructor(readonly controlPlaneId:string,private readonly endpoint:string,
    private readonly signer:WorkerMessageSigner,options:{allowLocalHttp?:boolean}={}){
    z.string().min(1).max(160).parse(controlPlaneId);
    z.uuid().parse(signer.deviceId);
    let url:URL;
    try{url=new URL(endpoint);}catch{throw new WorkerPollingError('UNTRUSTED_ENDPOINT');}
    const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
    if(url.username||url.password||url.search||url.hash||url.pathname!=='/worker/socket'||
      (url.protocol!=='wss:'&&!(options.allowLocalHttp===true&&
        process.env.NODE_ENV!=='production'&&local&&url.protocol==='ws:')))
      throw new WorkerPollingError('UNTRUSTED_ENDPOINT');
  }

  private signedBody(body:unknown){
    const unsigned={workerDeviceId:this.signer.deviceId,
      controlPlaneId:this.controlPlaneId,messageId:randomUUID(),
      signedAt:new Date().toISOString(),bodyHash:workerMessageHash(body)};
    return {envelope:{...unsigned,signature:Buffer.from(this.signer.signChallenge(
      workerSignatureBytes(unsigned))).toString('base64url')},body};
  }

  private failPending(){
    for(const [id,item] of this.pending){clearTimeout(item.timer);
      item.reject(new WorkerPollingError('TRANSPORT_FAILED'));this.pending.delete(id);}
  }

  private async connect():Promise<WebSocket>{
    if(this.closed)throw new WorkerPollingError('TRANSPORT_FAILED');
    if(this.socket?.readyState===WebSocket.OPEN)return this.socket;
    if(this.connecting)return this.connecting;
    this.connecting=new Promise<WebSocket>((resolve,reject)=>{
      const socket=new WebSocket(this.endpoint,{handshakeTimeout:10_000,
        maxPayload:2_621_440,perMessageDeflate:false});
      const timeout=setTimeout(()=>socket.terminate(),10_000);
      let settled=false;
      const failed=()=>{clearTimeout(timeout);
        if(!settled){settled=true;reject(new WorkerPollingError('TRANSPORT_FAILED'));}
        if(this.socket===socket)this.socket=null;
        if(this.liveness){clearInterval(this.liveness);this.liveness=null;}
        this.failPending();};
      socket.on('open',()=>{
        clearTimeout(timeout);if(settled)return;settled=true;
        this.socket=socket;this.pongSeen=true;
        this.liveness=setInterval(()=>{
          if(!this.pongSeen){socket.terminate();return;}
          this.pongSeen=false;socket.ping();
        },15_000);this.liveness.unref();resolve(socket);
      });
      socket.on('pong',()=>{this.pongSeen=true;});
      socket.on('message',(data,isBinary)=>{
        if(isBinary){socket.terminate();return;}
        let parsed:z.infer<typeof response>;
        try{parsed=response.parse(JSON.parse(data.toString()) as unknown);}
        catch{socket.terminate();return;}
        const item=this.pending.get(parsed.id);if(!item)return;
        this.pending.delete(parsed.id);clearTimeout(item.timer);
        if(parsed.status>=400){
          const denied=rpcDenial.safeParse(parsed.body);
          item.reject(denied.success?new WorkerJobRpcError(denied.data.code):
            new WorkerPollingError('TRANSPORT_FAILED'));
        }else item.resolve(parsed.body);
      });
      socket.on('error',failed);socket.on('close',failed);
    }).finally(()=>{this.connecting=null;});
    return this.connecting;
  }

  private async request(kind:'POLL'|'MESSAGE'|'RPC',body:unknown,
    rpcKind?:string,timeoutMs=35_000):Promise<unknown>{
    const socket=await this.connect();
    const id=randomUUID();
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(id);
        reject(new WorkerPollingError('TRANSPORT_FAILED'));socket.terminate();},timeoutMs);
      this.pending.set(id,{resolve,reject,timer});
      const frame=canonicalJson({id,kind,rpcKind,body:this.signedBody(body)});
      if(Buffer.byteLength(frame)>262_144){clearTimeout(timer);this.pending.delete(id);
        reject(new WorkerPollingError('RESPONSE_LIMIT'));return;}
      socket.send(frame,(error)=>{if(error){const item=this.pending.get(id);
        if(item){clearTimeout(item.timer);this.pending.delete(id);
          reject(new WorkerPollingError('TRANSPORT_FAILED'));}}});
    });
  }

  async send(raw:unknown):Promise<void>{
    const message=outbound.parse(raw);
    if(message.workerDeviceId!==this.signer.deviceId||
      message.controlPlaneId!==this.controlPlaneId)
      throw new WorkerPollingError('WRONG_CONTROL_PLANE');
    await this.request('MESSAGE',message,undefined,15_000);
  }

  async poll(raw:unknown):Promise<z.infer<typeof pollResponse>['messages']>{
    const hello=WorkerHelloSchema.parse(raw);
    if(hello.workerDeviceId!==this.signer.deviceId||
      hello.controlPlaneId!==this.controlPlaneId)
      throw new WorkerPollingError('WRONG_CONTROL_PLANE');
    const parsed=pollResponse.safeParse(await this.request('POLL',hello));
    if(!parsed.success||parsed.data.messages.some((item)=>
      item.controlPlaneId!==this.controlPlaneId)||
      parsed.data.messages[0]?.type!=='WORKER_WELCOME'||
      !parsed.data.messages[0].pauseDirective)
      throw new WorkerPollingError('PROTOCOL_MISMATCH');
    return parsed.data.messages;
  }

  async postJobRpc(kind:'ACCEPT'|'ACCEPTED_INPUT'|'TRANSITION'|'RENEW_LEASE'|
    'PREPARE_RESULT_ASSET'|'FINALIZE_RESULT'|'RESEARCH_SEARCH'|'RESEARCH_FETCH'|
    'RESEARCH_DOWNLOAD'|'PRIVATE_RESOURCE_READ',body:unknown):Promise<unknown>{
    return this.request('RPC',body,kind,30_000);
  }

  async close():Promise<void>{
    this.closed=true;this.socket?.terminate();this.socket=null;
    if(this.liveness){clearInterval(this.liveness);this.liveness=null;}
    this.failPending();
  }
}
