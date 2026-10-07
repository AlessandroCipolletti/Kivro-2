import { timingSafeEqual } from 'node:crypto';
import { getMarketplaceAgentService } from '../../../../../src/agent/server.js';

export const runtime='nodejs';
export async function GET(request:Request):Promise<Response>{
  const secret=process.env.AGENT_CRON_SECRET;
  const bearer=request.headers.get('authorization')?.replace(/^Bearer /,'')??'';
  if(!secret||secret.length<32||bearer.length!==secret.length||
    !timingSafeEqual(Buffer.from(bearer),Buffer.from(secret)))
    return Response.json({code:'UNAUTHORIZED'},{status:401,
      headers:{'Cache-Control':'no-store'}});
  const url=new URL(request.url);
  const from=new Date(url.searchParams.get('from')??Date.now()-7*86_400_000);
  const to=new Date(url.searchParams.get('to')??Date.now());
  try{return Response.json(await getMarketplaceAgentService().usage.metrics(from,to),{
    headers:{'Cache-Control':'no-store'}});}
  catch{return Response.json({code:'INVALID_RANGE'},{status:400,
    headers:{'Cache-Control':'no-store'}});}
}
