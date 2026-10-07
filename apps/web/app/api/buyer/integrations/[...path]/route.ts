import { getAuthService } from '../../../../../src/auth/server.js';
import { handleBuyerIntegrationManagement } from
  '../../../../../src/buyer-api/management-handler.js';

export const runtime='nodejs';
interface Context{params:Promise<{path:string[]}>}
async function handle(request:Request,context:Context){
  return handleBuyerIntegrationManagement(request,(await context.params).path,getAuthService());
}
export const GET=handle;
export const POST=handle;
export const PATCH=handle;
export const DELETE=handle;
