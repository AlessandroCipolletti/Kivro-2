import { getAuthService } from '../../../../src/auth/server.js';
import { handleMarketplaceRequest } from '../../../../src/marketplace/handler.js';

interface Context { params: Promise<{path:string[]}> }
export const runtime='nodejs';
async function handle(request:Request,context:Context):Promise<Response>{
  return handleMarketplaceRequest(request,(await context.params).path,getAuthService());
}
export const GET=handle;
export const POST=handle;
export const PUT=handle;
