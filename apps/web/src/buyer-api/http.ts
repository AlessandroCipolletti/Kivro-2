import { BuyerApiError } from '../../../../packages/persistence/src/buyer-api-keys.js';

export async function readBoundedJson(request:Request):Promise<unknown>{
  if(request.headers.get('content-type')?.split(';')[0]?.trim()!=='application/json'||!request.body)
    throw new BuyerApiError('INVALID_INPUT');
  const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{for(;;){const next=await reader.read();if(next.done)break;
    size+=next.value.byteLength;if(size>1_048_576)throw new BuyerApiError('INVALID_INPUT');
    chunks.push(next.value);}}
  finally{reader.releaseLock();}
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}
