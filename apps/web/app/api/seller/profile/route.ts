import { getAuthService } from '../../../../src/auth/server.js';
import { handleSellerProfileRequest } from '../../../../src/seller/profile-handler.js';

export async function GET(request: Request): Promise<Response> {
  return handleSellerProfileRequest(request, getAuthService());
}

export async function POST(request: Request): Promise<Response> {
  return handleSellerProfileRequest(request, getAuthService());
}
