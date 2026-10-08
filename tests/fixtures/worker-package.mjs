import {randomUUID} from 'node:crypto';

export function pkg(toolNames = []) {
  const capabilityVersionId = randomUUID();
  return { packageVersion: 1, capabilityId: randomUUID(), capabilityVersionId,
    workerDeviceId: randomUUID(), workerManifest: { manifestVersion: 1,
      workerId: randomUUID(), capabilityVersionId,
      runtime: { type: 'openclaw', supportedVersionRange: '>=2026.8.2 <2026.9.0' },
      skills: [], tools: { allow: toolNames, deny: ['exec', 'browser', 'gateway'] },
      resources: [], network: { default: 'deny', allow: [] },
      limits: { timeoutSeconds: 60, memoryMb: 1024, cpu: 1, maxPids: 128,
        maxInputBytes: 1000, maxOutputBytes: 65536 } },
    dependencyGraph: { graphVersion: 1, rootId: 'skill', inference: null, alternatives: [],
      nodes: [{ id: 'skill', type: 'SKILL', name: 'Skill', requirement: 'REQUIRED',
        sensitivity: 'LOW', discoveredFrom: ['SKILL_METADATA'], dependsOn: [],
        marketplaceSupport: 'UNDETERMINED', confidence: 'CONFIRMED', selected: false,
        health: 'UNKNOWN' }] },
    permissionPolicy: { policyVersion: 1, aiInference: 'SELLER', providerBudget: {
      providerId: 'synthetic', modelId: 'broker', credentialRef: 'seller:provider',
      maxRequestsPerJob: 3, maxInputTokensPerRequest: 8192, maxOutputTokensPerRequest: 1024,
      maxEstimatedSpendMicroUsdPerJob: 100_000,
      inputPriceMicroUsdPerMillionTokens: 1_000_000,
      outputPriceMicroUsdPerMillionTokens: 1_000_000 },
      publicInternet: 'PUBLIC_RESEARCH_BROKER', internet: { version: 1,
        mode: 'PUBLIC_WEB_RESEARCH', domains: { mode: 'ANY_PUBLIC_DOMAIN' },
        search: { enabled: true, maxQueriesPerJob: 3, maxResults: 5 },
        fetch: { enabled: false, maxPagesPerJob: 1, maxResponseBytes: 100_000,
          maxRedirects: 0, timeoutMs: 1000, allowedContentTypes: ['text/plain'] },
        download: { enabled: false, maxDownloadsPerJob: 1, maxFileBytes: 100_000,
          maxBytesPerJob: 100_000, allowedMimeTypes: [] },
        limits: { maxNetworkBytesPerJob: 2_000_000, maxDurationMs: 10_000,
          maxConcurrentRequests: 1, maxRequestsPerHost: 3 } },
      browser: false, proprietaryDatabase: 'NONE', privateApi: 'NONE',
      selectedFileResourceIds: [], selectedDirectoryResourceIds: [], localSoftware: false,
      shell: false, externalSideEffects: false, buyerFileAccess: false,
      sellerCredentialRefs: ['seller:provider'] }, sellerInferenceConfigHash: `sha256:${'a'.repeat(64)}`,
    ioContract: { contractVersion: 1, input: { schemaVersion: 1, fields: [{
      key: 'question', label: 'Question', order: 0, required: true, type: 'SHORT_TEXT' }] },
      output: { schemaVersion: 1, fields: [{ key: 'answer', label: 'Answer', order: 0,
        required: true, type: 'SHORT_TEXT' }] } }, priceTier: 'USD_999',
    dependencySnapshot: [], concurrencyLimit: 1, pauseSupport: 'FULL_RESUME',
    exampleRefs: [], testRefs: [] };
}
