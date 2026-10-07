import { getAuthService } from '../../../../../src/auth/server.js';
import { handleSellerPublicationRequest } from '../../../../../src/seller/publication-handler.js';

export const dynamic='force-dynamic';
type Context={params:Promise<{action:string}>};
export async function GET(request:Request,context:Context):Promise<Response>{
  return handleSellerPublicationRequest(request,(await context.params).action,getAuthService());
}
export async function POST(request:Request,context:Context):Promise<Response>{
  return handleSellerPublicationRequest(request,(await context.params).action,getAuthService());
}
