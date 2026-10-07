import { z } from 'zod';
import { AgentToolNameSchema } from '../../contracts/src/marketplace-agent.js';
import { PlatformInferenceError } from
  '../../infrastructure/contracts/src/platform-inference-ports.js';

export interface PlatformToolHandler {
  readonly schema: z.ZodType<unknown>;
  readonly execute: (argumentsValue: unknown, buyerId: string) => Promise<unknown>;
}

/** Tool names and buyer identity come from code; model arguments are untrusted. */
export class PlatformToolExecutor {
  constructor(private readonly handlers: Readonly<Partial<Record<z.infer<typeof AgentToolNameSchema>,
    PlatformToolHandler>>>) {}

  async execute(calls: readonly {id:string;name:string;arguments:unknown}[],
    buyerId:string):Promise<readonly {id:string;name:string;result:unknown}[]> {
    z.uuid().parse(buyerId);
    if(calls.length>8||new Set(calls.map((call)=>call.id)).size!==calls.length)
      throw new PlatformInferenceError('INVALID_REQUEST');
    const results=[];
    for(const call of calls){
      const name=AgentToolNameSchema.safeParse(call.name);
      if(!name.success)throw new PlatformInferenceError('INVALID_REQUEST');
      const handler=this.handlers[name.data];
      if(!handler)throw new PlatformInferenceError('INVALID_REQUEST');
      const parsed=handler.schema.safeParse(call.arguments);
      if(!parsed.success)throw new PlatformInferenceError('INVALID_REQUEST');
      results.push({id:z.string().min(1).max(160).parse(call.id),name:name.data,
        result:await handler.execute(parsed.data,buyerId)});
    }
    return results;
  }
}
