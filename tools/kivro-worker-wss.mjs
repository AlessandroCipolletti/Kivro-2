import process from 'node:process';
import {startWorkerWebSocketServer} from '../dist/apps/web/src/worker/websocket-server.js';

const host=process.env.KIVRO_WORKER_WSS_HOST??'127.0.0.1';
const port=Number(process.env.KIVRO_WORKER_WSS_PORT??'0');
if(!Number.isSafeInteger(port)||port<1||port>65535)
  throw new Error('WORKER_WSS_PORT_REQUIRED');
const certFile=process.env.KIVRO_WORKER_WSS_CERT_FILE;
const keyFile=process.env.KIVRO_WORKER_WSS_KEY_FILE;
if(Boolean(certFile)!==Boolean(keyFile))throw new Error('WORKER_WSS_TLS_INCOMPLETE');
const server=await startWorkerWebSocketServer({host,port,
  ...(certFile&&keyFile?{tls:{certFile,keyFile}}:{}),
  allowLocalWs:process.env.KIVRO_ALLOW_LOCAL_HTTP==='true'});
process.stdout.write(`Kivro Worker WSS listener ready on port ${server.port}\n`);
for(const name of ['SIGINT','SIGTERM'])process.once(name,()=>void server.close()
  .then(()=>{process.exitCode=0;}));
