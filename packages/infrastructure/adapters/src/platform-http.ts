import { PlatformInferenceError, type PlatformInferenceErrorCode } from
  '../../contracts/src/platform-inference-ports.js';

function statusCode(status: number): PlatformInferenceErrorCode {
  if (status === 401 || status === 403) return 'AUTHENTICATION_ERROR';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 408 || status === 504) return 'TIMEOUT';
  if (status === 404) return 'MODEL_UNAVAILABLE';
  if (status === 400 || status === 422) return 'INVALID_REQUEST';
  if (status >= 500) return 'PROVIDER_UNAVAILABLE';
  return 'UNKNOWN_PROVIDER_ERROR';
}

async function classifiedError(response:Response):Promise<PlatformInferenceErrorCode>{
  const fallback=statusCode(response.status);
  const reader=response.body?.getReader();if(!reader)return fallback;
  const chunks:Uint8Array[]=[];let size=0;
  try{for(;;){const next=await reader.read();if(next.done)break;
    size+=next.value.byteLength;
    if(size>8192){await reader.cancel();return fallback;}
    chunks.push(next.value);}}
  catch{return fallback;}finally{reader.releaseLock();}
  try{
    const body=JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
      error?:{code?:unknown;type?:unknown;message?:unknown}};
    const marker=[body.error?.code,body.error?.type,body.error?.message]
      .filter((item):item is string=>typeof item==='string').join(' ').toLowerCase();
    if(/content[_ -]?(?:policy|filter)|safety[_ -]?(?:policy|filter)/.test(marker))
      return 'CONTENT_POLICY';
    if(/context[_ -]?(?:length|window|limit)|prompt (?:is )?too long|too many tokens/.test(marker))
      return 'CONTEXT_LIMIT';
    if(/model[_ -]?(?:not[_ -]?found|unavailable|not[_ -]?supported)/.test(marker))
      return 'MODEL_UNAVAILABLE';
  }catch{/* Non-JSON errors retain HTTP classification. */}
  return fallback;
}

export async function boundedProviderPost(url: string, headers: Record<string, string>,
  body: unknown, fetcher: typeof fetch = fetch): Promise<unknown> {
  let response: Response;
  try {
    response = await fetcher(url, { method: 'POST', headers: {
      'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000) });
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new PlatformInferenceError('TIMEOUT', true);
    }
    throw new PlatformInferenceError('PROVIDER_UNAVAILABLE', true);
  }
  if (!response.ok) {
    const code = await classifiedError(response);
    throw new PlatformInferenceError(code, ['RATE_LIMITED','PROVIDER_UNAVAILABLE','TIMEOUT'].includes(code));
  }
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > 1_048_576) {
    await response.body?.cancel(); throw new PlatformInferenceError('INVALID_OUTPUT');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new PlatformInferenceError('INVALID_OUTPUT');
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    for (;;) {
      const next = await reader.read(); if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > 1_048_576) throw new PlatformInferenceError('INVALID_OUTPUT');
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown; }
  catch { throw new PlatformInferenceError('INVALID_OUTPUT'); }
}

export function safeUsage(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 10_000_000 ? value : 0;
}
