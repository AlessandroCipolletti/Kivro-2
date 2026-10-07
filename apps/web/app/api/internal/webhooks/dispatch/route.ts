import { timingSafeEqual } from 'node:crypto';
import { getBuyerWebhooks,getWebhookTransport } from
  '../../../../../src/buyer-api/server.js';

export const runtime='nodejs';
export async function POST(request:Request):Promise<Response>{
  const secret=process.env.KIVRO_WEBHOOK_CRON_SECRET;
  const bearer=request.headers.get('authorization')?.replace(/^Bearer /,'')??'';
  if(!secret||secret.length<32||bearer.length!==secret.length||
    !timingSafeEqual(Buffer.from(secret),Buffer.from(bearer)))
    return Response.json({code:'UNAUTHORIZED'},{status:401,
      headers:{'Cache-Control':'no-store'}});
  const delivered=await getBuyerWebhooks().deliverDue(getWebhookTransport(),20);
  return Response.json({attempted:delivered},{headers:{'Cache-Control':'no-store'}});
}
