import { CapabilityIOContractSchema } from '../../contracts/src/capability-io.js';
import {
  CapabilityVersionCandidateSchema, PublishedCapabilityVersionSchema, DigestSchema,
  type CapabilityVersionCandidate, type PublishedCapabilityVersion, type JobContractSnapshot,
  JobContractSnapshotSchema,
} from '../../contracts/src/capability-version.js';
import { LocalCapabilityPackageSchema } from '../../contracts/src/capability-package.js';
import { hashCanonicalJson } from '../../contracts/src/canonical-json.js';
import { buildPublicPermissionManifest } from '../../policy-engine/src/public-manifest.js';
import { hashWorkerManifest } from '../../contracts/src/worker-manifest.js';
import { PriceSnapshotSchema, type PriceSnapshot } from '../../contracts/src/pricing.js';

function freezeDeep<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) freezeDeep(nested);
    Object.freeze(value);
  }
  return value;
}

export interface VersionCandidateInput {
  readonly id: string;
  readonly capabilityId: string;
  readonly versionNumber: number;
  readonly workerDeviceId: string;
  readonly requestedAt: string;
  readonly localPackage: unknown;
  /** Server-validated enabled catalog price; required by the publication service. */
  readonly selectedPrice: PriceSnapshot;
  readonly externalProcessors?: readonly string[];
}

export function buildVersionCandidate(input: VersionCandidateInput): Readonly<CapabilityVersionCandidate> {
  const localPackage = LocalCapabilityPackageSchema.parse(input.localPackage);
  // The contract knows this future mode, but the MVP runtime cannot safely
  // restart an atomic step from a durable checkpoint. Never publish that claim.
  if(localPackage.pauseSupport==='RESTART_STEP')
    throw new TypeError('RESTART_STEP requires a verified checkpoint runtime');
  if (localPackage.capabilityVersionId !== input.id || localPackage.capabilityId !== input.capabilityId ||
    localPackage.workerDeviceId !== input.workerDeviceId) {
    throw new TypeError('Local package identity mismatch');
  }
  const manifest = localPackage.workerManifest;
  const permissionPolicy = localPackage.permissionPolicy;
  const noExternalAccess=(permissionPolicy.aiInference==='NONE'||
    localPackage.dependencyGraph.inference?.mode==='LOCAL')&&
    permissionPolicy.publicInternet==='DENY'&&permissionPolicy.privateApi==='NONE'&&
    !permissionPolicy.externalSideEffects;
  if(!noExternalAccess&&(!input.externalProcessors||input.externalProcessors.length===0))
    throw new TypeError('External processors must be declared before publication');
  const ioContract = CapabilityIOContractSchema.parse(localPackage.ioContract);
  const version = CapabilityVersionCandidateSchema.parse({
    id: input.id,
    capabilityId: input.capabilityId,
    versionNumber: input.versionNumber,
    workerDeviceId: input.workerDeviceId,
    localWorkerId: manifest.workerId,
    publicationState: 'DRAFT',
    requestedAt: input.requestedAt,
    runtime: manifest.runtime,
    workerManifestHash: hashWorkerManifest(manifest),
    localPackageHash: hashCanonicalJson(localPackage),
    dependencyGraphHash: hashCanonicalJson(localPackage.dependencyGraph),
    permissionPolicyHash: hashCanonicalJson(permissionPolicy),
    publicResearchPolicy: permissionPolicy.internet?.mode === 'PUBLIC_WEB_RESEARCH' ? permissionPolicy.internet : null,
    sellerInferenceConfigHash: localPackage.sellerInferenceConfigHash === null ? null : DigestSchema.parse(localPackage.sellerInferenceConfigHash),
    ioContract,
    publicPermissionManifest: buildPublicPermissionManifest(permissionPolicy),
    price: PriceSnapshotSchema.parse({ tier: input.selectedPrice.tier,
      currency: input.selectedPrice.currency,
      buyerAmountMinor: input.selectedPrice.buyerAmountMinor,
      platformFeeMinor: input.selectedPrice.platformFeeMinor,
      sellerEarningMinor: input.selectedPrice.sellerEarningMinor }),
    dependencySnapshot: localPackage.dependencySnapshot,
    externalProcessors: input.externalProcessors??[],
    resourceLimits: manifest.limits,
    concurrencyLimit: localPackage.concurrencyLimit,
    pauseSupport: localPackage.pauseSupport,
    exampleRefs: localPackage.exampleRefs,
    testRefs: localPackage.testRefs,
  });
  if (version.price.tier !== localPackage.priceTier) throw new TypeError('Selected tier mismatch');
  return freezeDeep(version);
}

export function createJobContractSnapshot(
  published: PublishedCapabilityVersion,
  jobId: string,
  buyerAccountId: string,
  createdAt: string,
): Readonly<JobContractSnapshot> {
  const version = PublishedCapabilityVersionSchema.parse(published);
  const snapshot = JobContractSnapshotSchema.parse({
    jobId,
    buyerAccountId,
    capabilityId: version.capabilityId,
    capabilityVersionId: version.id,
    versionNumber: version.versionNumber,
    workerDeviceId: version.workerDeviceId,
    createdAt,
    permissionManifestSnapshot: version.publicPermissionManifest,
    publicResearchPolicySnapshot: version.publicResearchPolicy,
    inputContractSnapshot: version.ioContract.input,
    outputContractSnapshot: version.ioContract.output,
    priceSnapshot: version.price,
    pauseSupportSnapshot: version.pauseSupport,
    externalProcessorsSnapshot: version.externalProcessors,
  });
  return freezeDeep(snapshot);
}

/** Seller-facing semantic preview. An opaque policy-hash change is explicitly
 * called out; a category summary is never presented as a complete access diff. */
export function describePublicationChanges(previous: PublishedCapabilityVersion,
  next: CapabilityVersionCandidate): readonly string[] {
  const before=PublishedCapabilityVersionSchema.parse(previous);
  const after=CapabilityVersionCandidateSchema.parse(next);
  if(before.capabilityId!==after.capabilityId||after.versionNumber<=before.versionNumber)
    throw new TypeError('Publication versions cannot be compared');
  const changes:string[]=[];
  const money=(minor:number)=>`$${(minor/100).toFixed(2)}`;
  if(before.price.buyerAmountMinor!==after.price.buyerAmountMinor||
    before.price.platformFeeMinor!==after.price.platformFeeMinor||
    before.price.sellerEarningMinor!==after.price.sellerEarningMinor)
    changes.push(`Economics: buyer ${money(before.price.buyerAmountMinor)} → ${
      money(after.price.buyerAmountMinor)}, Kivro fee ${money(before.price.platformFeeMinor)} → ${
      money(after.price.platformFeeMinor)}, seller proceeds ${money(before.price.sellerEarningMinor)} → ${
      money(after.price.sellerEarningMinor)}`);
  for(const side of ['input','output'] as const){
    if(hashCanonicalJson(before.ioContract[side])!==hashCanonicalJson(after.ioContract[side]))
      changes.push(`${side==='input'?'Buyer input':'Result output'} contract changed`);
  }
  const oldAccess=new Map(before.publicPermissionManifest.entries.map((entry)=>
    [entry.category,entry.state]));
  for(const entry of after.publicPermissionManifest.entries){
    const state=oldAccess.get(entry.category);
    if(state!==entry.state)changes.push(`Access ${entry.category.replaceAll('_',' ')}: ${
      state??'not declared'} → ${entry.state}`);
  }
  if(before.permissionPolicyHash!==after.permissionPolicyHash)
    changes.push('Detailed permission policy changed; review exact local access before consent');
  if(before.workerManifestHash!==after.workerManifestHash)
    changes.push('Worker skills, tools, resources or limits changed');
  if(hashCanonicalJson(before.dependencySnapshot)!==hashCanonicalJson(after.dependencySnapshot))
    changes.push('Dependency versions or content changed');
  if(hashCanonicalJson(before.publicResearchPolicy)!==hashCanonicalJson(after.publicResearchPolicy))
    changes.push('Public research destinations or limits changed');
  if(hashCanonicalJson(before.externalProcessors)!==hashCanonicalJson(after.externalProcessors))
    changes.push('External processors changed');
  if(before.sellerInferenceConfigHash!==after.sellerInferenceConfigHash)
    changes.push('Inference configuration changed');
  return changes.length?changes:['No buyer-visible or declared access change'];
}
