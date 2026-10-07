import https from 'node:https';
import { isPublicInternetAddress, NetworkPolicyError } from
  '../../../policy-engine/src/public-destination.js';
import { parseWebhookUrl } from '../../../application/src/webhook-policy.js';
import type { PinnedWebhookPostPort } from '../../contracts/src/ports.js';

/** Direct TLS socket to a vetted public IP. No proxy, redirect, pooling or second DNS lookup. */
export class NodePinnedWebhookPost implements PinnedWebhookPostPort {
  post(input:{url:URL;pinnedAddress:string;body:Uint8Array;
    headers:Readonly<Record<string,string>>;timeoutMs:number;maxResponseBytes:number}):
    Promise<{status:number}>{
    const url=parseWebhookUrl(input.url.href);
    if(!isPublicInternetAddress(input.pinnedAddress)||input.body.byteLength>32_768||
      !Number.isInteger(input.timeoutMs)||input.timeoutMs<1||input.timeoutMs>15_000||
      !Number.isInteger(input.maxResponseBytes)||input.maxResponseBytes<1||
      input.maxResponseBytes>4096)throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
    return new Promise((resolve,reject)=>{
      const request=https.request(url,{hostname:input.pinnedAddress,
        servername:url.hostname.replace(/^\[|\]$/g,''),method:'POST',agent:false,
        rejectUnauthorized:true,
        headers:{...input.headers,Host:url.host,'Content-Type':'application/json',
          'Content-Length':String(input.body.byteLength),'Accept-Encoding':'identity'}},(response)=>{
        let size=0;
        response.on('data',(chunk:Buffer)=>{size+=chunk.byteLength;
          if(size>input.maxResponseBytes)response.destroy(new NetworkPolicyError('NETWORK_BUDGET_EXCEEDED'));});
        response.on('error',reject);
        response.on('end',()=>{clearTimeout(deadline);resolve({status:response.statusCode??0});});
      });
      const deadline=setTimeout(()=>request.destroy(
        new NetworkPolicyError('NETWORK_BUDGET_EXCEEDED')),input.timeoutMs);
      request.on('error',(error)=>{clearTimeout(deadline);reject(error);});
      request.end(input.body);
    });
  }
}
