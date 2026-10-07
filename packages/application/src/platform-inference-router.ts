import { z } from 'zod';
import { AgentInferenceTaskSchema, type AgentInferenceTask } from
  '../../contracts/src/marketplace-agent.js';
import { PlatformInferenceError, type PlatformInferenceProvider,
  type PlatformInferenceRequest, type PlatformInferenceResponse,
  type PlatformInferenceUsageSink } from
  '../../infrastructure/contracts/src/platform-inference-ports.js';

const profile = z.strictObject({
  provider: z.enum(['openai','anthropic']), model: z.string().trim().min(1).max(160),
  supportsStructuredOutput: z.boolean(), supportsTools: z.boolean(),
  inputMicrousdPerMillion: z.number().int().nonnegative().nullable(),
  outputMicrousdPerMillion: z.number().int().nonnegative().nullable(),
  fallbackProvider: z.enum(['openai','anthropic']).optional(),
  fallbackModel: z.string().trim().min(1).max(160).optional(),
}).refine((value) => (!!value.fallbackProvider) === (!!value.fallbackModel));
export const PlatformInferenceProfilesSchema = z.partialRecord(AgentInferenceTaskSchema, profile);
export type PlatformInferenceProfiles = z.infer<typeof PlatformInferenceProfilesSchema>;
export interface PlatformInferenceDebugEvent {readonly requestId:string;readonly task:AgentInferenceTask;
  readonly provider:string;readonly model:string;readonly outcome:'SUCCESS'|'FAILURE';
  readonly latencyMs:number;readonly inputTokens:number;readonly outputTokens:number;
  readonly toolCallCount:number;readonly errorCode?:string;}

function estimateCost(response: PlatformInferenceResponse, config: z.infer<typeof profile>): number|null {
  if (config.inputMicrousdPerMillion === null || config.outputMicrousdPerMillion === null) return null;
  const uncached = Math.max(0, response.usage.inputTokens - response.usage.cachedInputTokens);
  const total = uncached * config.inputMicrousdPerMillion +
    response.usage.outputTokens * config.outputMicrousdPerMillion;
  return Number.isSafeInteger(total) ? Math.ceil(total / 1_000_000) : null;
}

/** Per-task routing and accounting are platform-owned. Neither provider sees Worker secrets. */
export class PlatformInferenceRouter {
  private readonly profiles: PlatformInferenceProfiles;
  private readonly providers: Map<string, PlatformInferenceProvider>;
  private emitDebug(event:PlatformInferenceDebugEvent):void{
    try{this.debug?.(event);}catch{/* Development observability cannot change inference outcome. */}
  }
  constructor(rawProfiles: unknown, providerList: readonly PlatformInferenceProvider[],
    private readonly usage: PlatformInferenceUsageSink,
    private readonly debug?: (event:PlatformInferenceDebugEvent)=>void) {
    this.profiles = PlatformInferenceProfilesSchema.parse(rawProfiles);
    this.providers = new Map(providerList.map((provider) => [provider.id, provider]));
    for (const [task, config] of Object.entries(this.profiles)) {
      if (!this.providers.has(config.provider)) {
        throw new PlatformInferenceError('CONFIGURATION_ERROR');
      }
      if (['INTENT_EXTRACTION','ORCHESTRATION_PLANNING','INPUT_PREPARATION'].includes(task) &&
        !config.supportsStructuredOutput) throw new PlatformInferenceError('CONFIGURATION_ERROR');
      if (config.fallbackProvider && !this.providers.has(config.fallbackProvider)) {
        throw new PlatformInferenceError('CONFIGURATION_ERROR');
      }
    }
  }

  async health(): Promise<{overall:'READY'|'DEGRADED'|'UNAVAILABLE';
    providers:readonly {id:string;health:'READY'|'UNAVAILABLE'}[];
    tasks:readonly {task:AgentInferenceTask;available:boolean}[]}> {
    const providers=await Promise.all([...this.providers.values()].map(async(provider)=>({
      id:provider.id,health:await provider.healthCheck()})));
    const tasks=AgentInferenceTaskSchema.options.map((task)=>({task,
      available:!!this.profiles[task] && providers.some((provider)=>
        provider.id===this.profiles[task]?.provider&&provider.health==='READY')}));
    const ready=tasks.filter((task)=>task.available).length;
    return {overall:ready===tasks.length?'READY':ready?'DEGRADED':'UNAVAILABLE',providers,tasks};
  }

  async generate(request: PlatformInferenceRequest): Promise<PlatformInferenceResponse> {
    const config=this.profiles[request.task];
    if (!config || !request.metadata.userId || request.maxOutputTokens < 1 ||
      request.maxOutputTokens > 4096 || request.messages.length > 16 ||
      request.messages.some((message)=>message.content.length>20_000) ||
      request.system.length>8_000 || (request.tools?.length??0)>12 ||
      (request.toolExchange&&(
        request.toolExchange.calls.length>4||
        request.toolExchange.calls.length!==request.toolExchange.results.length||
        request.toolExchange.calls.some((call,index)=>
          call.id!==request.toolExchange!.results[index]?.id||
          call.name!==request.toolExchange!.results[index]?.name)||
        JSON.stringify(request.toolExchange).length>20_000))) {
      throw new PlatformInferenceError('INVALID_REQUEST');
    }
    if (request.responseSchema && !config.supportsStructuredOutput) {
      throw new PlatformInferenceError('CONFIGURATION_ERROR');
    }
    if (request.tools?.length && !config.supportsTools) {
      throw new PlatformInferenceError('CONFIGURATION_ERROR');
    }
    await this.usage.recordRoutingConfiguration?.(this.profiles);
    const requestId=await this.usage.reserveRequest({userId:request.metadata.userId,
      task:request.task,maxTokens:request.maxOutputTokens});
    const sequence:readonly {provider:string;model:string}[] = config.fallbackProvider ?
      [{provider:config.provider,model:config.model},
        {provider:config.fallbackProvider,model:config.fallbackModel!}] :
      [{provider:config.provider,model:config.model}];
    let latest: PlatformInferenceError|null=null;
    for (const [index,target] of sequence.entries()) {
      const provider=this.providers.get(target.provider);
      if (!provider) throw new PlatformInferenceError('CONFIGURATION_ERROR');
      let response: PlatformInferenceResponse;
      try {
        response=await provider.generate(request,target.model);
        if (response.provider!==provider.id || response.model!==target.model ||
          response.toolCalls.length>12) throw new PlatformInferenceError('INVALID_OUTPUT');
      } catch (error) {
        latest=error instanceof PlatformInferenceError ? error :
          new PlatformInferenceError('UNKNOWN_PROVIDER_ERROR');
        if (!latest.retryable || index===sequence.length-1) break;
        continue;
      }
      // Recording is authoritative accounting. Its failure cannot be treated as
      // a provider failure and must never trigger a second inference request.
      await this.usage.recordUsage({requestId,userId:request.metadata.userId,
        ...(request.metadata.conversationId?{conversationId:request.metadata.conversationId}:{}),
        ...(request.metadata.orchestrationId?{orchestrationId:request.metadata.orchestrationId}:{}),
        task:request.task,provider:response.provider,model:response.model,
        ...response.usage,estimatedCostMicrousd:index===0?estimateCost(response,config):null,
        latencyMs:response.latencyMs,outcome:'SUCCESS',toolCallCount:response.toolCalls.length});
      this.emitDebug({requestId,task:request.task,provider:response.provider,
        model:response.model,outcome:'SUCCESS',latencyMs:response.latencyMs,
        inputTokens:response.usage.inputTokens,outputTokens:response.usage.outputTokens,
        toolCallCount:response.toolCalls.length});
      return response;
    }
    await this.usage.recordUsage({requestId,userId:request.metadata.userId,
      ...(request.metadata.conversationId?{conversationId:request.metadata.conversationId}:{}),
      ...(request.metadata.orchestrationId?{orchestrationId:request.metadata.orchestrationId}:{}),
      task:request.task,provider:config.provider,model:config.model,
      inputTokens:0,outputTokens:0,cachedInputTokens:0,estimatedCostMicrousd:null,
      latencyMs:0,outcome:'FAILURE',errorCode:latest?.code??'UNKNOWN_PROVIDER_ERROR',toolCallCount:0});
    this.emitDebug({requestId,task:request.task,provider:config.provider,model:config.model,
      outcome:'FAILURE',latencyMs:0,inputTokens:0,outputTokens:0,toolCallCount:0,
      errorCode:latest?.code??'UNKNOWN_PROVIDER_ERROR'});
    throw latest??new PlatformInferenceError('UNKNOWN_PROVIDER_ERROR');
  }
}
