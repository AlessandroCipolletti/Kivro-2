import { detectFileMime, SUPPORTED_FILE_TYPES } from '../../contracts/src/file-types.js';
import type { ObjectStoragePort } from '../../infrastructure/contracts/src/ports.js';

export class ResultFileSafetyError extends Error {
  constructor(readonly code:'UNSUPPORTED_TYPE'|'INVALID_TEXT'|'INVALID_JSON'){
    super(code);this.name='ResultFileSafetyError';
  }
}

/** Independently re-identify cloud-owned bytes; a Worker MIME claim is not evidence. */
export async function verifyResultFileType(storage:ObjectStoragePort,key:string,
  claimedMime:string):Promise<void>{
  const candidate=SUPPORTED_FILE_TYPES.find((item)=>item.mime===claimedMime);
  if(!candidate)throw new ResultFileSafetyError('UNSUPPORTED_TYPE');
  const extension=candidate.extensions[0];
  const text=['text/plain','text/markdown','text/csv','application/json','model/obj']
    .includes(claimedMime);
  const decoder=text?new TextDecoder('utf-8',{fatal:true}):null;
  const json:Buffer[]=[];
  let prefix=Buffer.alloc(0),jsonBytes=0;
  for await(const chunk of await storage.readPrivateObject(key)){
    if(prefix.byteLength<4096)prefix=Buffer.concat([prefix,
      Buffer.from(chunk.subarray(0,4096-prefix.byteLength))]);
    if(decoder){
      if(Buffer.from(chunk).includes(0))throw new ResultFileSafetyError('INVALID_TEXT');
      try{decoder.decode(chunk,{stream:true});}
      catch{throw new ResultFileSafetyError('INVALID_TEXT');}
    }
    if(claimedMime==='application/json'){
      jsonBytes+=chunk.byteLength;if(jsonBytes>1_048_576)throw new ResultFileSafetyError('INVALID_JSON');
      json.push(Buffer.from(chunk));
    }
  }
  if(decoder)try{decoder.decode();}catch{throw new ResultFileSafetyError('INVALID_TEXT');}
  if(detectFileMime(prefix,`result${extension}`)!==claimedMime)
    throw new ResultFileSafetyError('UNSUPPORTED_TYPE');
  if(claimedMime==='application/json')try{JSON.parse(Buffer.concat(json).toString('utf8'));}
    catch{throw new ResultFileSafetyError('INVALID_JSON');}
}
