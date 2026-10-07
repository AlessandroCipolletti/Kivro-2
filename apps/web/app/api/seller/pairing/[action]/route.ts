import { getAuthService } from '../../../../../src/auth/server.js';
import { handleSellerPairingRequest } from '../../../../../src/seller/pairing-handler.js';

export async function POST(request: Request, context: {
  params: Promise<{ action: string }>;
}): Promise<Response> {
  const { action } = await context.params;
  return handleSellerPairingRequest(request, action, getAuthService());
}
