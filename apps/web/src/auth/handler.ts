import type { AuthService } from './server.js';
import { guardAuthReturnPaths, guardGoogleIdentityRequest } from './request-guard.js';
import { classifyAuthRequest } from './audit.js';

/** One HTTP boundary for browser auth and integration tests. */
export async function handleAuthRequest(request: Request, service: AuthService): Promise<Response> {
  const event = classifyAuthRequest(request);
  const returnPathRejection = await guardAuthReturnPaths(request);
  if (returnPathRejection) return audited(event, returnPathRejection, service);
  const googleRejection = await guardGoogleIdentityRequest(request);
  if (googleRejection) return audited(event, googleRejection, service);
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/api/auth/verify-email') {
    const token = url.searchParams.get('token');
    if (!token || !await service.verificationTokens.consume(token)) {
      return audited(event, new Response('Invalid or used verification link', { status: 401, headers: { 'cache-control': 'no-store' } }), service);
    }
  }
  return audited(event, await service.auth.handler(request), service);
}

async function audited(event: ReturnType<typeof classifyAuthRequest>, response: Response, service: AuthService): Promise<Response> {
  if (!event) return response;
  try {
    await service.audit.record(event, response.status);
    return response;
  } catch {
    // Do not forward a newly issued session cookie when required auditing fails.
    return new Response('Authentication temporarily unavailable', { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}
