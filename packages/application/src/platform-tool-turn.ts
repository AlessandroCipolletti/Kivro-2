import { z } from 'zod';
import type { PlatformInferenceRequest } from
  '../../infrastructure/contracts/src/platform-inference-ports.js';
import { PlatformInferenceError } from
  '../../infrastructure/contracts/src/platform-inference-ports.js';
import type { PlatformInferenceRouter } from './platform-inference-router.js';
import type { MarketplaceAgentTools } from './marketplace-agent-tools.js';

/** At most one model tool round. All requested tools pass the buyer-scoped allowlist. */
export async function runPlatformToolTurn<T>(router:PlatformInferenceRouter,
  tools:MarketplaceAgentTools,buyerId:string,request:PlatformInferenceRequest,
  resultSchema:z.ZodType<T>):Promise<T>{
  const first=await router.generate({task:request.task,system:request.system,
    messages:request.messages,maxOutputTokens:request.maxOutputTokens,
    metadata:request.metadata,tools:tools.providerDefinitions});
  if(!first.toolCalls.length){
    let value:unknown=first.structuredOutput;
    if(value===null&&first.text){
      try{value=JSON.parse(first.text) as unknown;}
      catch{throw new PlatformInferenceError('INVALID_OUTPUT');}
    }
    const parsed=resultSchema.safeParse(value);
    if(!parsed.success)throw new PlatformInferenceError('INVALID_OUTPUT');
    return parsed.data;
  }
  if(first.toolCalls.length>4)throw new PlatformInferenceError('INVALID_OUTPUT');
  const results=await tools.executeModelCalls(first.toolCalls,buyerId);
  const encoded=JSON.stringify({toolResults:results});
  if(encoded.length>20_000)throw new PlatformInferenceError('INVALID_OUTPUT');
  const second=await router.generate({...request,tools:[],messages:request.messages,
    toolExchange:{calls:first.toolCalls,results},
    ...(request.responseSchema?{responseSchema:request.responseSchema}:{})});
  if(second.toolCalls.length)throw new PlatformInferenceError('INVALID_OUTPUT');
  const parsed=resultSchema.safeParse(second.structuredOutput);
  if(!parsed.success)throw new PlatformInferenceError('INVALID_OUTPUT');
  return parsed.data;
}
