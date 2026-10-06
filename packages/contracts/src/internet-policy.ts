import { z } from 'zod';

const domain = z.string().min(4).max(253).regex(/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/);
const positive = (max: number) => z.number().int().min(1).max(max);
const mime = z.string().regex(/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/).max(100);

export const InternetPolicySchema = z.discriminatedUnion('mode', [
  z.strictObject({ version: z.literal(1), mode: z.literal('NO_NETWORK') }),
  z.strictObject({
    version: z.literal(1), mode: z.literal('PUBLIC_WEB_RESEARCH'),
    domains: z.discriminatedUnion('mode', [
      z.strictObject({ mode: z.literal('ANY_PUBLIC_DOMAIN') }),
      z.strictObject({ mode: z.literal('ONLY_DECLARED_DOMAINS'), hosts: z.array(domain).min(1).max(32) }),
    ]),
    search: z.strictObject({ enabled: z.boolean(), maxQueriesPerJob: positive(30), maxResults: positive(20) }),
    fetch: z.strictObject({ enabled: z.boolean(), maxPagesPerJob: positive(50), maxResponseBytes: positive(5_000_000),
      maxRedirects: z.number().int().min(0).max(5), timeoutMs: positive(15_000),
      allowedContentTypes: z.array(mime).min(1).max(12) }),
    download: z.strictObject({ enabled: z.boolean(), maxDownloadsPerJob: positive(20), maxFileBytes: positive(10_000_000),
      maxBytesPerJob: positive(50_000_000), allowedMimeTypes: z.array(z.enum([
        'image/jpeg', 'image/png', 'application/pdf', 'text/csv',
      ])).max(4) }),
    limits: z.strictObject({ maxNetworkBytesPerJob: positive(100_000_000), maxDurationMs: positive(3_600_000),
      maxConcurrentRequests: positive(4), maxRequestsPerHost: positive(40) }),
  }).superRefine((value, ctx) => {
    if (value.download.enabled && value.download.allowedMimeTypes.length === 0) ctx.addIssue({ code: 'custom', message: 'Downloads need allowed MIME types' });
    if (value.domains.mode === 'ONLY_DECLARED_DOMAINS' && new Set(value.domains.hosts).size !== value.domains.hosts.length) ctx.addIssue({ code: 'custom', message: 'Duplicate host' });
    const redirectReserve = value.fetch.maxRedirects * 65_536;
    if ((value.search.enabled && value.limits.maxNetworkBytesPerJob < 1_000_000) ||
        (value.fetch.enabled && value.limits.maxNetworkBytesPerJob < value.fetch.maxResponseBytes + redirectReserve) ||
        (value.download.enabled && (value.limits.maxNetworkBytesPerJob < value.download.maxFileBytes + redirectReserve ||
          value.download.maxBytesPerJob < value.download.maxFileBytes + redirectReserve))) {
      ctx.addIssue({ code: 'custom', message: 'Total budget must cover one maximum operation' });
    }
  }),
  z.strictObject({ version: z.literal(1), mode: z.literal('DECLARED_API_ACCESS'),
    connectors: z.array(z.strictObject({
      id: z.string().regex(/^[a-z][a-z0-9.-]{1,79}$/), host: domain,
      method: z.enum(['GET', 'HEAD', 'POST']), path: z.string().startsWith('/').max(256).refine((p) => !p.includes('..')),
      maxRequestsPerJob: positive(100), maxRequestBytes: positive(100_000), maxResponseBytes: positive(5_000_000),
    })).min(1).max(16) }).refine((value) => new Set(value.connectors.map((item) => item.id)).size === value.connectors.length,
    'Duplicate API connector'),
]);

export type InternetPolicy = z.infer<typeof InternetPolicySchema>;
export type PublicResearchPolicy = Extract<InternetPolicy, { mode: 'PUBLIC_WEB_RESEARCH' }>;
