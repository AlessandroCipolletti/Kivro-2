import { getAuthService } from '../../../../../src/auth/server.js';
import { handleSellerOperationsRequest } from '../../../../../src/seller/operations-handler.js';

interface Context {params:Promise<{path:string[]}>}
export const runtime='nodejs';
async function handle(request:Request,context:Context):Promise<Response>{
  return handleSellerOperationsRequest(request,(await context.params).path,getAuthService());
}
export const GET=handle;
export const POST=handle;
