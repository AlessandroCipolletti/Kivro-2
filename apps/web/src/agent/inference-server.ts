import { OpenAIPlatformProvider } from '../../../../packages/infrastructure/adapters/src/openai-platform.js';
import { AnthropicPlatformProvider } from '../../../../packages/infrastructure/adapters/src/anthropic-platform.js';
import { PlatformInferenceRouter, PlatformInferenceProfilesSchema } from
  '../../../../packages/application/src/platform-inference-router.js';
import { PostgresPlatformInferenceUsage } from
  '../../../../packages/persistence/src/platform-inference-usage.js';
import { getAuthService } from '../auth/server.js';
import { PlatformInferenceError } from
  '../../../../packages/infrastructure/contracts/src/platform-inference-ports.js';

/** Server-only composition root. No provider key is returned in API or job envelopes. */
export function createPlatformInferenceRouter():PlatformInferenceRouter|null {
  const providers=[];
  if(process.env.OPENAI_API_KEY)providers.push(new OpenAIPlatformProvider(process.env.OPENAI_API_KEY));
  if(process.env.ANTHROPIC_API_KEY)providers.push(new AnthropicPlatformProvider(process.env.ANTHROPIC_API_KEY));
  if(!providers.length)return null;
  let profiles:unknown;
  if(process.env.PLATFORM_AI_PROFILES_JSON){
    try{profiles=JSON.parse(process.env.PLATFORM_AI_PROFILES_JSON) as unknown;}
    catch{throw new PlatformInferenceError('CONFIGURATION_ERROR');}
  }else{
    const id=process.env.PLATFORM_AI_DEFAULT_PROVIDER;
    const model=id==='openai'?process.env.OPENAI_PLATFORM_MODEL:
      id==='anthropic'?process.env.ANTHROPIC_PLATFORM_MODEL:undefined;
    if(!id||!model)throw new PlatformInferenceError('CONFIGURATION_ERROR');
    profiles=Object.fromEntries([
      'INTENT_EXTRACTION','DISCOVERY_RERANK','RECOMMENDATION',
      'ORCHESTRATION_PLANNING','INPUT_PREPARATION','RESULT_SYNTHESIS',
    ].map((task)=>[task,{provider:id,model,supportsStructuredOutput:true,
      supportsTools:true,inputMicrousdPerMillion:null,outputMicrousdPerMillion:null}]));
  }
  const checked=PlatformInferenceProfilesSchema.safeParse(profiles);
  if(!checked.success)throw new PlatformInferenceError('CONFIGURATION_ERROR');
  const debugRequested=process.env.PLATFORM_AI_DEBUG_METADATA==='true';
  if(debugRequested&&process.env.NODE_ENV==='production')
    throw new PlatformInferenceError('CONFIGURATION_ERROR');
  if(debugRequested)process.stderr.write('WARNING: Platform AI metadata debug is enabled for local development. Prompts, responses, keys and buyer content are redacted.\n');
  return new PlatformInferenceRouter(checked.data,providers,
    new PostgresPlatformInferenceUsage(getAuthService().database),
    debugRequested?(event)=>process.stderr.write(`platform_ai_debug ${JSON.stringify(event)}\n`):
      undefined);
}
