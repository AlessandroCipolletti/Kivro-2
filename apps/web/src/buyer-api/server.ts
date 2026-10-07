import { BuyerApiKeyRepository } from '../../../../packages/persistence/src/buyer-api-keys.js';
import { BuyerWebhookRepository } from '../../../../packages/persistence/src/buyer-webhooks.js';
import { SystemDnsResolver } from '../../../../packages/infrastructure/http/src/pinned-http.js';
import { NodePinnedWebhookPost } from '../../../../packages/infrastructure/http/src/pinned-webhook-post.js';
import { getAuthService } from '../auth/server.js';

function required(name:string){const value=process.env[name];
  if(!value)throw new Error(`Missing buyer API configuration: ${name}`);return value;}
let keys:BuyerApiKeyRepository|undefined;
let webhooks:BuyerWebhookRepository|undefined;
export function getBuyerApiKeys(){
  const mode=required('KIVRO_STRIPE_MODE');
  if(mode!=='live'&&mode!=='test')throw new Error('Invalid Stripe mode');
  return keys??=new BuyerApiKeyRepository(getAuthService().database,mode);
}
export function getBuyerWebhooks(){
  const configured=process.env.KIVRO_WEBHOOK_BLOCKED_HOSTS;
  if(process.env.NODE_ENV==='production'&&!configured)
    throw new Error('Missing webhook control-plane host denylist');
  const blocked=[process.env.APP_ORIGIN,process.env.WORKER_DISCOVERY_URL]
    .flatMap((value)=>{try{return value?[new URL(value).hostname]:[];}catch{return [];}})
    .concat((configured??'').split(',').map((item)=>item.trim().toLowerCase()).filter(Boolean));
  return webhooks??=new BuyerWebhookRepository(getAuthService().database,new SystemDnsResolver(),
    required('KIVRO_WEBHOOK_ENCRYPTION_KEY'),blocked);
}
export function getWebhookTransport(){return new NodePinnedWebhookPost();}
