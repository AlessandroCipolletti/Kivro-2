import { handleAuthRequest } from '../../../../src/auth/handler.js';
import { getAuthService } from '../../../../src/auth/server.js';

export async function GET(request: Request): Promise<Response> {
  return handleAuthRequest(request, getAuthService());
}

export async function POST(request: Request): Promise<Response> {
  return handleAuthRequest(request, getAuthService());
}
