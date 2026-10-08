import {readFileSync} from 'node:fs';
import {createServer as createHttpServer} from 'node:http';
import {createServer as createHttpsServer} from 'node:https';
import type {AddressInfo} from 'node:net';
import {z} from 'zod';
import {WebSocketServer,WebSocket} from 'ws';
import {handleWorkerJobRpc,handleWorkerMessage,handleWorkerPoll,
  type WorkerJobRpcKind} from './control-handler.js';

const frame=z.strictObject({id:z.uuid(),kind:z.enum(['POLL','MESSAGE','RPC']),
  rpcKind:z.enum(['ACCEPT','ACCEPTED_INPUT','TRANSITION','RENEW_LEASE',
    'PREPARE_RESULT_ASSET','FINALIZE_RESULT','RESEARCH_SEARCH','RESEARCH_FETCH',
    'RESEARCH_DOWNLOAD','PRIVATE_RESOURCE_READ']).optional(),
  body:z.strictObject({envelope:z.unknown(),body:z.unknown()})});
type Handlers={poll:(request:Request)=>Promise<Response>;
  message:(request:Request)=>Promise<Response>;
  rpc:(request:Request,kind:WorkerJobRpcKind)=>Promise<Response>};

/** Dedicated Node endpoint; all signed frames use the existing HTTPS Core
 * handlers, so WSS cannot create a second execution or finance path. */
export async function startWorkerWebSocketServer(config:{host:string;port:number;
  tls?:{certFile:string;keyFile:string};allowLocalWs?:boolean;
  handlers?:Handlers}){
  const loopback=['127.0.0.1','localhost','::1'].includes(config.host);
  if(!config.tls&&!(config.allowLocalWs===true&&
    process.env.NODE_ENV!=='production'&&loopback))
    throw new Error('WORKER_WSS_TLS_REQUIRED');
  const server=config.tls?createHttpsServer({cert:readFileSync(config.tls.certFile),
    key:readFileSync(config.tls.keyFile)}):createHttpServer();
  const webSocketServer=new WebSocketServer({noServer:true,maxPayload:262_144,
    perMessageDeflate:false});
  const handlers=config.handlers??{poll:handleWorkerPoll,message:handleWorkerMessage,
    rpc:handleWorkerJobRpc};
  const sockets=new Set<WebSocket>();
  server.on('upgrade',(request,socket,head)=>{
    if(request.url!=='/worker/socket'||request.headers.origin||sockets.size>=100){
      socket.destroy();return;
    }
    webSocketServer.handleUpgrade(request,socket,head,(webSocket)=>{
      sockets.add(webSocket);webSocketServer.emit('connection',webSocket,request);
    });
  });
  webSocketServer.on('connection',(socket)=>{
    let alive=true;
    const ping=setInterval(()=>{if(!alive){socket.terminate();return;}
      alive=false;socket.ping();},15_000);ping.unref();
    socket.on('pong',()=>{alive=true;});
    socket.on('close',()=>{clearInterval(ping);sockets.delete(socket);});
    socket.on('message',async(raw,isBinary)=>{
      if(isBinary){socket.terminate();return;}
      const parsed=frame.safeParse((()=>{try{return JSON.parse(raw.toString()) as unknown;}
        catch{return null;}})());
      if(!parsed.success){socket.terminate();return;}
      const request=new Request(`${config.tls?'https':'http'}://localhost/worker/socket`,{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify(parsed.data.body)});
      let response:Response;
      try{response=parsed.data.kind==='POLL'?await handlers.poll(request):
        parsed.data.kind==='MESSAGE'?await handlers.message(request):
          parsed.data.rpcKind?await handlers.rpc(request,parsed.data.rpcKind):
            Response.json({code:'INVALID_INPUT'},{status:400});}
      catch{response=Response.json({code:'TRANSPORT_FAILED'},{status:503});}
      let body:unknown;
      try{body=response.status===204?undefined:await response.json();}
      catch{body={code:'TRANSPORT_FAILED'};}
      if(socket.readyState===WebSocket.OPEN){
        const output=JSON.stringify({id:parsed.data.id,status:response.status,body});
        if(Buffer.byteLength(output)>2_621_440){socket.terminate();return;}
        socket.send(output);
      }
    });
  });
  await new Promise<void>((resolve,reject)=>{
    server.once('error',reject);server.listen(config.port,config.host,()=>{
      server.off('error',reject);resolve();});
  });
  const address=server.address() as AddressInfo;
  return {port:address.port,close:async()=>{
    for(const socket of sockets)socket.terminate();
    await new Promise<void>((resolve)=>webSocketServer.close(()=>resolve()));
    await new Promise<void>((resolve)=>server.close(()=>resolve()));
  }};
}
