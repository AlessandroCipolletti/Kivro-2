import {getAuthService} from '../../../../../../src/auth/server.js';
import {handleSellerWorkerRevokeRequest} from
  '../../../../../../src/seller/pairing-handler.js';

export const runtime='nodejs';
export async function POST(request:Request,context:{params:Promise<{deviceId:string}>}){
  const {deviceId}=await context.params;
  return handleSellerWorkerRevokeRequest(request,deviceId,getAuthService());
}
