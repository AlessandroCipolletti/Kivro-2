import {getAuthService} from '../../../../../../src/auth/server.js';
import {handleSellerOperationsRequest} from
  '../../../../../../src/seller/operations-handler.js';

export const runtime='nodejs';
type Context={params:Promise<{capabilityId:string}>};
export async function POST(request:Request,context:Context):Promise<Response>{
  return handleSellerOperationsRequest(request,
    ['capability',(await context.params).capabilityId,'pause'],getAuthService());
}
