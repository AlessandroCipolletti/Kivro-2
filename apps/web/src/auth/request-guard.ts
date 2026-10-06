async function readFields(request: Request): Promise<{ fields: Record<string, unknown> } | { error: Response }> {
  const clone = request.clone();
  const reader = clone.body?.getReader();
  if (!reader) return { error: new Response('Invalid auth request', { status: 400 }) };
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) return { error: new Response('Auth request too large', { status: 413 }) };
      parts.push(value);
    }
    const body: unknown = JSON.parse(Buffer.concat(parts).toString('utf8'));
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return { error: new Response('Invalid auth request', { status: 400 }) };
    }
    return { fields: body as Record<string, unknown> };
  } catch {
    return { error: new Response('Invalid auth request', { status: 400 }) };
  } finally {
    reader.releaseLock();
  }
}

function internalPath(value: unknown): boolean {
  if (typeof value !== 'string' || value.length > 2048 || !value.startsWith('/') ||
    value.startsWith('//') || value.includes('\\') ||
    [...value].some((character) => character.charCodeAt(0) < 32) ||
    /%(?:2f|5c|0[0-9a-f])/i.test(value)) return false;
  try { return new URL(value, 'http://kivro.internal').origin === 'http://kivro.internal'; }
  catch { return false; }
}

/** Callback and reset destinations stay inside the Kivro app for every auth entry point. */
export async function guardAuthReturnPaths(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/auth/')) return null;
  if (request.method === 'GET') {
    const callbackURL = url.searchParams.get('callbackURL');
    return callbackURL !== null && !internalPath(callbackURL)
      ? new Response('Invalid callback path', { status: 400 }) : null;
  }
  if (request.method !== 'POST') return null;
  // Only parse routes that can receive a browser return destination. Other
  // Better Auth operations (for example sign-out) may legitimately have no body.
  if (!new Set([
    '/api/auth/sign-up/email', '/api/auth/sign-in/email', '/api/auth/sign-in/social',
    '/api/auth/send-verification-email', '/api/auth/request-password-reset',
    '/api/auth/reset-password', '/api/auth/link-social',
  ]).has(url.pathname)) return null;
  const parsed = await readFields(request);
  if ('error' in parsed) return parsed.error;
  for (const key of ['callbackURL', 'newUserCallbackURL', 'errorCallbackURL', 'redirectTo']) {
    const value = parsed.fields[key];
    if (value !== undefined && !internalPath(value)) return new Response('Invalid callback path', { status: 400 });
  }
  return null;
}

/** Reject client-supplied scopes/authorization parameters before Better Auth starts Google OAuth. */
export async function guardGoogleIdentityRequest(request: Request): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (request.method !== 'POST' || path !== '/api/auth/sign-in/social') return null;
  const parsed = await readFields(request);
  if ('error' in parsed) return parsed.error;
  const fields = parsed.fields;
  if (fields.provider !== 'google' || fields.idToken !== undefined || fields.additionalParams !== undefined ||
    fields.additionalData !== undefined || (fields.scopes !== undefined &&
      (!Array.isArray(fields.scopes) || fields.scopes.length > 0))) {
    return new Response('Unsupported identity request', { status: 400 });
  }
  for (const key of ['callbackURL', 'newUserCallbackURL', 'errorCallbackURL']) {
    const value = fields[key];
    if (value === undefined) continue;
    if (!internalPath(value)) return new Response('Invalid callback path', { status: 400 });
  }
  return null;
}
