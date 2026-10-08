import {WorkerDiscoveryDocumentSchema} from
  '../../../../packages/worker-protocol/src/discovery.js';

/** Public routing metadata only. The Worker still authenticates every message
 * and the Core independently authorizes each new lease. */
export function handleWorkerDiscovery(request:Request):Response{
  if(request.method!=='GET')return Response.json({code:'METHOD_NOT_ALLOWED'},
    {status:405,headers:{'Cache-Control':'no-store'}});
  try{
    const id=process.env.KIVRO_CONTROL_PLANE_ID;
    const state=process.env.KIVRO_CONTROL_PLANE_STATE;
    const origin=new URL(process.env.APP_ORIGIN??'');
    const loopback=['localhost','127.0.0.1','[::1]'].includes(origin.hostname);
    if(!id||(state!=='ACTIVE'&&state!=='DRAINING')||origin.username||origin.password||
      origin.pathname!=='/'||origin.search||origin.hash||
      (origin.protocol!=='https:'&&!(process.env.NODE_ENV!=='production'&&
        process.env.KIVRO_ALLOW_LOCAL_HTTP==='true'&&loopback&&
        origin.protocol==='http:')))throw new Error('DISCOVERY_NOT_CONFIGURED');
    const raw=process.env.KIVRO_WORKER_DISCOVERY_PLANES_JSON;
    const wss=process.env.KIVRO_WORKER_WSS_URL;
    const document=WorkerDiscoveryDocumentSchema.parse(raw?JSON.parse(raw):{
      discoveryVersion:1,controlPlanes:[{id,state,endpoint:origin.origin,
        transports:[{type:'POLLING',version:1,endpoint:origin.origin},
          ...(wss?[{type:'WEBSOCKET',version:1,endpoint:wss}]:[])]}]});
    const own=document.controlPlanes.find((plane)=>plane.id===id);
    if(!own||own.state!==state||new URL(own.endpoint).origin!==origin.origin)
      throw new Error('DISCOVERY_NOT_CONFIGURED');
    for(const plane of document.controlPlanes){
      const endpoint=new URL(plane.endpoint);
      const local=['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname);
      if(endpoint.username||endpoint.password||endpoint.pathname!=='/'||
        endpoint.search||endpoint.hash||
        (endpoint.protocol!=='https:'&&!(process.env.NODE_ENV!=='production'&&
          process.env.KIVRO_ALLOW_LOCAL_HTTP==='true'&&local&&
          endpoint.protocol==='http:')))
        throw new Error('DISCOVERY_ENDPOINT_UNSAFE');
      for(const transport of plane.transports??[]){
        const target=new URL(transport.endpoint);
        const localTransport=['localhost','127.0.0.1','[::1]'].includes(target.hostname);
        const development=process.env.NODE_ENV!=='production'&&
          process.env.KIVRO_ALLOW_LOCAL_HTTP==='true'&&localTransport;
        if(target.username||target.password||target.search||target.hash||
          (transport.type==='POLLING'?(target.pathname!=='/'||
            target.protocol!=='https:'&&!(development&&target.protocol==='http:')):
            target.pathname!=='/worker/socket'||target.protocol!=='wss:'&&
              !(development&&target.protocol==='ws:')))
          throw new Error('DISCOVERY_TRANSPORT_UNSAFE');
      }
    }
    return Response.json(document,{headers:{'Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff'}});
  }catch{return Response.json({code:'DISCOVERY_UNAVAILABLE'},
    {status:503,headers:{'Cache-Control':'no-store'}});}
}
