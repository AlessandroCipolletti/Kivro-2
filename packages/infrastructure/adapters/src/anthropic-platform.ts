import { z } from 'zod';
import { PlatformInferenceError, type PlatformInferenceProvider,
  type PlatformInferenceRequest } from '../../contracts/src/platform-inference-ports.js';
import { boundedProviderPost, safeUsage } from './platform-http.js';

const responseSchema = z.object({
  stop_reason: z.string().nullable().optional(),
  content: z.array(z.object({ type: z.string(), text: z.string().optional(),
    id: z.string().optional(), name: z.string().optional(), input: z.unknown().optional() })),
  usage: z.object({ input_tokens: z.number().optional(), output_tokens: z.number().optional(),
    cache_read_input_tokens: z.number().optional() }).optional(),
});

/** Official Messages API; no Anthropic response type leaks into Core. */
export class AnthropicPlatformProvider implements PlatformInferenceProvider {
  readonly id = 'anthropic' as const;
  constructor(private readonly key: string, private readonly fetcher: typeof fetch = fetch) {
    if (!key || /^(example|replace|your[-_])/i.test(key))
      throw new PlatformInferenceError('CONFIGURATION_ERROR');
  }
  async healthCheck(): Promise<'READY'|'UNAVAILABLE'> {
    try{const response=await this.fetcher('https://api.anthropic.com/v1/models',{
      headers:{'x-api-key':this.key,'anthropic-version':'2023-06-01'},
      signal:AbortSignal.timeout(5000)});
      await response.body?.cancel();return response.ok?'READY':'UNAVAILABLE';}
    catch{return 'UNAVAILABLE';}
  }
  async generate(request: PlatformInferenceRequest, model: string) {
    const start = Date.now();
    const body = {
      model, max_tokens: request.maxOutputTokens, system: request.system,
      messages: [...request.messages.map((message) => ({
        role: message.role === 'ASSISTANT' ? 'assistant' : 'user', content: message.content })),
        ...(request.toolExchange?[{role:'assistant',content:request.toolExchange.calls
          .map((call)=>({type:'tool_use',id:call.id,name:call.name,input:call.arguments}))},
        {role:'user',content:request.toolExchange.results.map((result)=>({type:'tool_result',
          tool_use_id:result.id,content:JSON.stringify(result.result)}))}]:[])],
      ...(request.responseSchema ? { output_config: { format: {
        type: 'json_schema', schema: request.responseSchema } } } : {}),
      ...(request.tools?.length ? { tools: request.tools.map((tool) => ({
        name: tool.name, description: tool.description,
        input_schema: tool.parameters, strict: true })) } : {}),
    };
    const parsed = responseSchema.safeParse(await boundedProviderPost(
      'https://api.anthropic.com/v1/messages', { 'x-api-key': this.key,
        'anthropic-version': '2023-06-01' }, body, this.fetcher));
    if (!parsed.success || parsed.data.stop_reason === 'max_tokens')
      throw new PlatformInferenceError('INVALID_OUTPUT');
    const text = parsed.data.content.filter((part) => part.type === 'text')
      .map((part) => part.text ?? '').join('\n') || null;
    const toolCalls = parsed.data.content.filter((part) => part.type === 'tool_use').map((part) => {
      if (!part.id || !part.name || part.input === undefined) throw new PlatformInferenceError('INVALID_OUTPUT');
      return { id: part.id, name: part.name, arguments: part.input };
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
        cachedInputTokens: safeUsage(parsed.data.usage?.cache_read_input_tokens) },
      latencyMs: Date.now() - start };
  }
}
