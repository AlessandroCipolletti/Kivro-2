import { getAuthService } from '../../../../src/auth/server.js';
import { handleAgentRequest } from '../../../../src/agent/handler.js';

export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{path:string[]}>};
export async function GET(request:Request,context:Context){
  return handleAgentRequest(request,(await context.params).path,getAuthService());
}
export async function POST(request:Request,context:Context){
  return handleAgentRequest(request,(await context.params).path,getAuthService());
}
