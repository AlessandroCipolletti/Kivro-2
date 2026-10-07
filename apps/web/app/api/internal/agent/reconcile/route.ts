import { timingSafeEqual } from 'node:crypto';
import { getMarketplaceAgentService } from '../../../../../src/agent/server.js';

export const runtime='nodejs';
export async function POST(request:Request):Promise<Response>{
  const secret=process.env.AGENT_CRON_SECRET;
  const bearer=request.headers.get('authorization')?.replace(/^Bearer /,'')??'';
  if(!secret||secret.length<32||bearer.length!==secret.length||
    !timingSafeEqual(Buffer.from(bearer),Buffer.from(secret)))
    return Response.json({code:'UNAUTHORIZED'},{status:401,
      headers:{'Cache-Control':'no-store'}});
  const result=await getMarketplaceAgentService().getAuthorizer().reconcile(50);
  return Response.json(result,{headers:{'Cache-Control':'no-store'}});
}
