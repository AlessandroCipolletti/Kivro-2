import { BuyerAgentConstraintsSchema, type BuyerAgentConstraints } from
  '../../contracts/src/marketplace-agent.js';
import { CapabilityDiscoveryDocumentSchema, type CapabilityDiscoveryDocument } from
  '../../contracts/src/marketplace.js';
import { assessFieldMapping } from '../../domain/src/io-compatibility.js';

export type AgentDiscoveryMode = 'RECOMMEND' | 'EXECUTE';
export interface RankedAgentCandidate {
  readonly document: CapabilityDiscoveryDocument;
  readonly score: number;
  readonly matchReasons: readonly string[];
}

function outputKinds(document: CapabilityDiscoveryDocument): Set<string> {
  const kinds = new Set<string>();
  for (const field of document.ioContract.output.fields) {
    kinds.add(field.type);
    if (field.type === 'FILE' || field.type === 'FILES') {
      for (const extension of field.constraints.allowedExtensions) kinds.add(extension.toLowerCase());
      for (const mime of field.constraints.allowedMimeTypes) {
        kinds.add(mime);
        if (mime === 'application/pdf') kinds.add('PDF');
        else if (mime.startsWith('image/')) kinds.add('IMAGE');
        else if (mime.startsWith('video/')) kinds.add('VIDEO');
        else if (mime.startsWith('audio/')) kinds.add('AUDIO');
        else kinds.add('FILE');
      }
    } else if (field.type === 'JSON') kinds.add('STRUCTURED');
    else if (['SHORT_TEXT','LONG_TEXT','MARKDOWN'].includes(field.type)) kinds.add('TEXT');
  }
  return kinds;
}

function inputsSupport(document: CapabilityDiscoveryDocument, types: readonly string[]): boolean {
  if (!types.length) return true;
  return types.every((wanted) => document.ioContract.input.fields.some((field) => {
    if (field.type === wanted || field.semanticType === wanted) return true;
    if (field.type === 'FILE' || field.type === 'FILES') {
      return field.constraints.allowedMimeTypes.includes(wanted) ||
        field.constraints.allowedExtensions.includes(wanted.toLowerCase());
    }
    return false;
  }));
}

/** Output/input mappings are only accepted when the shared contract engine proves safety. */
export function compatibleOutputToInput(source: CapabilityDiscoveryDocument,
  sourceOutputKey: string, target: CapabilityDiscoveryDocument,
  targetInputKey: string): boolean {
  const output = source.ioContract.output.fields.find((field) => field.key === sourceOutputKey);
  const input = target.ioContract.input.fields.find((field) => field.key === targetInputKey);
  if (!output || !input) return false;
  const decision = assessFieldMapping(output, input);
  return decision.status === 'DIRECT' || decision.status === 'SAFE_TEXT_MAPPING';
}

function timingEligible(document: CapabilityDiscoveryDocument, constraints: BuyerAgentConstraints,
  mode: AgentDiscoveryMode): boolean {
  const availability = document.availability;
  if (mode === 'RECOMMEND') return !constraints.onlineOnly ||
    (availability.status === 'ONLINE' && availability.acceptingImmediate);
  if (constraints.timing.mode === 'IMMEDIATE') {
    // M09 does not expose an evidence-backed queue ETA. Even a positive buyer
    // tolerance cannot turn an unknown wait into a claimed short wait.
    return availability.acceptingImmediate && availability.status === 'ONLINE';
  }
  if (availability.acceptingImmediate && availability.status === 'ONLINE') return true;
  if (!availability.canSchedule || !availability.nextAvailableAt ||
    !availability.workerReachable || !availability.readinessReady) return false;
  if (constraints.timing.mode === 'DEADLINE') {
    if (document.typicalRuntimeSeconds === null) return false;
    return Date.parse(availability.nextAvailableAt) + document.typicalRuntimeSeconds * 1000 <=
      Date.parse(constraints.timing.deadlineAt);
  }
  return true;
}

/** PUBLIC documents only. Filter first; model suggestions cannot revive a rejected candidate. */
export function rankAgentCandidates(rawDocuments: readonly unknown[], rawConstraints: unknown,
  mode: AgentDiscoveryMode, query: string, limit = 8): readonly RankedAgentCandidate[] {
  const constraints = BuyerAgentConstraintsSchema.parse(rawConstraints);
  if (!Number.isInteger(limit) || limit < 1 || limit > 24) throw new TypeError('Invalid candidate limit');
  const stop=new Set(['the','and','for','with','from','this','that','these','those',
    'need','want','please','could','would','should','into','about','create','make']);
  const terms = query.toLocaleLowerCase('en').split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length >= 3&&!stop.has(term)).slice(0, 12);
  const candidates: RankedAgentCandidate[] = [];
  const seen = new Set<string>();
  for (const raw of rawDocuments) {
    const doc = CapabilityDiscoveryDocumentSchema.parse(raw);
    if (seen.has(doc.capabilityId)) continue;
    seen.add(doc.capabilityId);
    if (constraints.category && doc.category !== constraints.category) continue;
    if (constraints.blockedSellerIds.includes(doc.sellerId)) continue;
    if (constraints.maxPerJobSpendMinor !== undefined && doc.priceMinor > constraints.maxPerJobSpendMinor) continue;
    if (constraints.maxTotalSpendMinor !== undefined && doc.priceMinor > constraints.maxTotalSpendMinor) continue;
    if (constraints.minRating !== undefined && (doc.rating.average ?? 0) < constraints.minRating) continue;
    if (constraints.maxRuntimeSeconds !== undefined &&
      (doc.typicalRuntimeSeconds === null || doc.typicalRuntimeSeconds > constraints.maxRuntimeSeconds)) continue;
    if (!constraints.outputTypes.every((type) => outputKinds(doc).has(type))) continue;
    if (!inputsSupport(doc, constraints.requiredInputTypes)) continue;
    if (!constraints.permissionLimits.every((limit) => doc.permissionManifest.entries.some((entry) =>
      entry.category === limit.category && limit.allowedStates.includes(entry.state)))) continue;
    if (!timingEligible(doc, constraints, mode)) continue;
    const haystack = [doc.name, doc.description, doc.category, ...doc.tags, ...doc.strengths,
      ...doc.outputs.map((field) => `${field.key} ${field.type}`),
      ...doc.ioContract.input.fields.flatMap((field)=>[field.label,
        field.semanticType??'',...(field.type==='FILE'||field.type==='FILES'?
          [...field.constraints.allowedMimeTypes,...field.constraints.allowedExtensions]:[])]),
      ...doc.ioContract.output.fields.flatMap((field)=>[field.label,
        field.semanticType??'',...(field.type==='FILE'||field.type==='FILES'?
          [...field.constraints.allowedMimeTypes,...field.constraints.allowedExtensions]:[])]),
      ...doc.exampleSummaries.map((example) => `${example.title} ${example.description}`)]
      .join(' ').toLocaleLowerCase('en');
    const matched = terms.filter((term) => haystack.includes(term));
    if(terms.length&&!matched.length)continue;
    const textScore = terms.length ? matched.length / terms.length : 0;
    const ratingScore = (doc.rating.average ?? 0) / 5;
    const confidence = Math.min(doc.rating.count / 20, 1);
    const usage = Math.min(Math.log1p(doc.completedJobs) / Math.log(101), 1);
    const availability = doc.availability.acceptingImmediate ? 1 :
      doc.availability.canSchedule ? 0.35 : 0;
    const preferred = constraints.preferredCapabilityIds.includes(doc.capabilityId) ? 0.2 : 0;
    const priceFit = constraints.maxTotalSpendMinor ?
      Math.max(0, 1 - doc.priceMinor / constraints.maxTotalSpendMinor) : 0;
    const score = Number((textScore * 5 + ratingScore * confidence + usage * 0.4 +
      availability * 0.6 + priceFit * 0.3 + preferred).toFixed(4));
    const matchReasons = [
      matched.length ? `Matches ${matched.slice(0, 3).join(', ')}` : 'Matches the requested contract filters',
      `Current published price $${(doc.priceMinor / 100).toFixed(2)}`,
      doc.availability.acceptingImmediate ? 'Available for immediate admission' :
        doc.availability.nextAvailableAt ? `Next availability ${doc.availability.nextAvailableAt}` :
          'Start time is not known',
    ];
    candidates.push({ document: doc, score, matchReasons });
  }
  candidates.sort((a, b) => b.score - a.score ||
    a.document.priceMinor - b.document.priceMinor ||
    a.document.capabilityId.localeCompare(b.document.capabilityId));
  return candidates.slice(0, limit);
}
