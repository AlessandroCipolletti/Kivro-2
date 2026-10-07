import { z } from 'zod';
import { PlatformInferenceError, type PlatformInferenceProvider,
  type PlatformInferenceRequest } from '../../contracts/src/platform-inference-ports.js';
import { boundedProviderPost, safeUsage } from './platform-http.js';

const responseSchema = z.object({
  status: z.string().optional(),
  output: z.array(z.object({ type: z.string(), name: z.string().optional(),
    call_id: z.string().optional(), arguments: z.string().optional(),
    content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional() })),
  usage: z.object({ input_tokens: z.number().optional(), output_tokens: z.number().optional(),
    input_tokens_details: z.object({ cached_tokens: z.number().optional() }).optional() }).optional(),
});

/** Official Responses API; provider-specific shapes stop at this adapter. */
export class OpenAIPlatformProvider implements PlatformInferenceProvider {
  readonly id = 'openai' as const;
  constructor(private readonly key: string, private readonly fetcher: typeof fetch = fetch) {
    if (!key || /^(example|replace|your[-_])/i.test(key))
      throw new PlatformInferenceError('CONFIGURATION_ERROR');
  }
  async healthCheck(): Promise<'READY'|'UNAVAILABLE'> {
    try{const response=await this.fetcher('https://api.openai.com/v1/models',{
      headers:{Authorization:`Bearer ${this.key}`},signal:AbortSignal.timeout(5000)});
      await response.body?.cancel();return response.ok?'READY':'UNAVAILABLE';}
    catch{return 'UNAVAILABLE';}
  }
  async generate(request: PlatformInferenceRequest, model: string) {
    const start = Date.now();
    const body = {
      model, store: false, max_output_tokens: request.maxOutputTokens,
      instructions: request.system,
      input: [...request.messages.map((message) => ({
        role: message.role === 'ASSISTANT' ? 'assistant' : 'user', content: message.content })),
        ...(request.toolExchange?.calls.map((call)=>({type:'function_call',
          call_id:call.id,name:call.name,arguments:JSON.stringify(call.arguments)}))??[]),
        ...(request.toolExchange?.results.map((result)=>({type:'function_call_output',
          call_id:result.id,output:JSON.stringify(result.result)}))??[])],
      ...(request.responseSchema ? { text: { format: {
        type: 'json_schema', name: 'kivro_agent_output', strict: true,
        schema: request.responseSchema } } } : {}),
      ...(request.tools?.length ? { tools: request.tools.map((tool) => ({
        type: 'function', name: tool.name, description: tool.description,
        parameters: tool.parameters, strict: true })) } : {}),
    };
    const parsed = responseSchema.safeParse(await boundedProviderPost(
      'https://api.openai.com/v1/responses', { Authorization: `Bearer ${this.key}` },
      body, this.fetcher));
    if (!parsed.success || (parsed.data.status && parsed.data.status !== 'completed')) {
      throw new PlatformInferenceError('INVALID_OUTPUT');
    }
    const text = parsed.data.output.flatMap((item) => item.type === 'message' ?
      (item.content ?? []).filter((part) => part.type === 'output_text').map((part) => part.text ?? '') : [])
      .join('\n') || null;
    const toolCalls = parsed.data.output.filter((item) => item.type === 'function_call').map((item) => {
      if (!item.call_id || !item.name || !item.arguments) throw new PlatformInferenceError('INVALID_OUTPUT');
      try { return { id: item.call_id, name: item.name, arguments: JSON.parse(item.arguments) as unknown }; }
      catch { throw new PlatformInferenceError('INVALID_OUTPUT'); }
    });
    let structuredOutput: unknown = null;
    if (request.responseSchema) {
      if (!text) throw new PlatformInferenceError('INVALID_OUTPUT');
      try { structuredOutput = JSON.parse(text) as unknown; }
      catch { throw new PlatformInferenceError('INVALID_OUTPUT'); }
    }
    return { provider: this.id, model, text, structuredOutput, toolCalls,
      usage: { inputTokens: safeUsage(parsed.data.usage?.input_tokens),
        outputTokens: safeUsage(parsed.data.usage?.output_tokens),
        cachedInputTokens: safeUsage(parsed.data.usage?.input_tokens_details?.cached_tokens) },
      latencyMs: Date.now() - start };
  }
}
