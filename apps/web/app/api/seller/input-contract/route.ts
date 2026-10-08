import {getAuthService} from '../../../../src/auth/server.js';
import {handleSellerInputContract} from '../../../../src/seller/input-contract-handler.js';

export const dynamic='force-dynamic';
export async function GET(request:Request):Promise<Response>{
  return handleSellerInputContract(request,getAuthService());
}
export async function POST(request:Request):Promise<Response>{
  return handleSellerInputContract(request,getAuthService());
}
