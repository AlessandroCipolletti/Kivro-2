import {getAuthService} from '../../../../../../src/auth/server.js';
import {handleSellerPublicationRequest} from
  '../../../../../../src/seller/publication-handler.js';

export const runtime='nodejs';
type Context={params:Promise<{capabilityId:string}>};
export async function POST(request:Request,context:Context):Promise<Response>{
  return handleSellerPublicationRequest(request,'publish',getAuthService(),
    (await context.params).capabilityId);
}
