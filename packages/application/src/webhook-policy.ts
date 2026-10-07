import { createHmac, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { isPublicInternetAddress, NetworkPolicyError, parseResearchUrl } from
  '../../policy-engine/src/public-destination.js';

export function parseWebhookUrl(raw:string,blockedHosts:readonly string[]=[]):URL{
  const url=parseResearchUrl(raw);
  if(url.protocol!=='https:'||url.search.length>1024)throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
  const host=url.hostname.toLowerCase().replace(/\.$/,'');
  if(host.endsWith('.internal')||host.endsWith('.localhost')||host.endsWith('.localdomain')||
    blockedHosts.some((item)=>item.toLowerCase().replace(/\.$/,'')===host))
    throw new NetworkPolicyError('PRIVATE_DESTINATION_DENIED');
  return url;
}
export function vettedWebhookAddress(url:URL,addresses:readonly string[]):string{
  if(addresses.length<1||addresses.length>32||addresses.some((ip)=>!isPublicInternetAddress(ip)))
    throw new NetworkPolicyError('PRIVATE_DESTINATION_DENIED');
  const host=url.hostname.replace(/^\[|\]$/g,'');
  if(isIP(host)&&!addresses.includes(host))throw new NetworkPolicyError('PRIVATE_DESTINATION_DENIED');
  return addresses[0]!;
}
export function webhookSignature(secret:string,timestamp:string,rawBody:Uint8Array):string{
  return createHmac('sha256',secret).update(timestamp).update('.').update(rawBody).digest('hex');
}
/** Reference verifier for buyer documentation and adversarial tests. */
export function verifyWebhookSignature(secret:string,timestamp:string,rawBody:Uint8Array,
  signature:string,eventId:string,seen:ReadonlySet<string>,nowSeconds=Math.floor(Date.now()/1000)){
  if(!/^\d{10,}$/.test(timestamp)||Math.abs(nowSeconds-Number(timestamp))>300||
    !/^[a-f0-9]{64}$/.test(signature)||!/^evt_[0-9a-f-]{36}$/.test(eventId)||seen.has(eventId))
    return false;
  const expected=Buffer.from(webhookSignature(secret,timestamp,rawBody),'hex');
  return timingSafeEqual(expected,Buffer.from(signature,'hex'));
}
