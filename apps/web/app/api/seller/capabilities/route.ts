import {getAuthService} from '../../../../src/auth/server.js';
import {handleSellerPublicationRequest} from
  '../../../../src/seller/publication-handler.js';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request):Promise<Response>{
  return handleSellerPublicationRequest(request,'capabilities',getAuthService());
}
export async function POST(request:Request):Promise<Response>{
  return handleSellerPublicationRequest(request,'capabilities',getAuthService());
}
