import { z } from 'zod';
import type { DatabaseSync } from 'node:sqlite';
import { canonicalJson, hashCanonicalJson } from '../../../packages/contracts/src/canonical-json.js';
import { LocalCapabilityPackageSchema, type LocalCapabilityPackage } from
  '../../../packages/contracts/src/capability-package.js';
import { CapabilityIOContractSchema } from '../../../packages/contracts/src/capability-io.js';
import { PriceTierSchema } from '../../../packages/contracts/src/pricing.js';
import { ProviderBudgetPolicySchema } from '../../../packages/contracts/src/provider-budget-policy.js';
import { LocalInferencePolicySchema } from '../../../packages/contracts/src/local-inference-policy.js';
import { ReadOnlyResourcePolicySchema } from '../../../packages/contracts/src/local-resource-policy.js';
import { InternetPolicySchema } from '../../../packages/contracts/src/internet-policy.js';
import { WorkerManifestSchema } from '../../../packages/contracts/src/worker-manifest.js';
import { PauseSupportSchema } from '../../../packages/contracts/src/job-control.js';
import { analyzeDependencyGraph } from '../../../packages/domain/src/dependency-graph.js';
import type { ImportDraft } from './import-drafts.js';
import type { ReadOnlyOpenClawDiscovery } from
  '../../../packages/openclaw-adapter/src/read-only-discovery.js';
import { openPrivateWorkerSqlite } from './local-state.js';
import { validateReviewedSkillSnapshots } from './capability-package-store.js';
import { captureSelectedLocalBinding } from './selected-local-file.js';

const authoring = z.strictObject({
  capabilityId: z.uuid(), capabilityVersionId: z.uuid(),
  supportedOpenClawVersionRange: z.string().min(1).max(120),
  ioContract: CapabilityIOContractSchema,
  priceTier: PriceTierSchema,
  providerBudget: ProviderBudgetPolicySchema.optional(),
  localInference: LocalInferencePolicySchema.optional(),
  localResources: z.array(ReadOnlyResourcePolicySchema).max(32).default([]),
  declaredApis: InternetPolicySchema.optional(),
  publicResearch: InternetPolicySchema.optional(),
  databaseCredentialRefs: z.record(z.string(),
    z.string().regex(/^seller:[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/)).default({}),
  apiCredentialRefs: z.record(z.string(),
    z.string().regex(/^seller:[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/)).default({}),
  selectedLocalPaths: z.array(z.strictObject({
    resourceId: z.string().min(1).max(160),
    absolutePath: z.string().min(2).max(4096).startsWith('/'),
  })).max(64).default([]),
  limits: WorkerManifestSchema.shape.limits,
  concurrencyLimit: z.number().int().positive().max(64),
  pauseSupport: PauseSupportSchema,
  sellerInstructions: z.string().max(100_000).optional(),
});

export class ImportPackageError extends Error {
  constructor(readonly code: 'SELECTION_INCOMPLETE' | 'DEPENDENCY_UNSUPPORTED' |
    'INFERENCE_MISMATCH' | 'SKILL_CHANGED' | 'CONFLICT' | 'CORRUPT' | 'NOT_FOUND') {
    super(code); this.name = 'ImportPackageError';
  }
}

type Prepared = Awaited<ReturnType<typeof prepareSelectedPackage>>;

/** Private, immutable candidate bytes. Staging is never a review or installation. */
export class WorkerUnreviewedPackageStore {
  private readonly db: DatabaseSync;
  constructor(stateDir: string) {
    this.db = openPrivateWorkerSqlite(stateDir, 'import.sqlite');
    this.db.exec(`CREATE TABLE IF NOT EXISTS import_unreviewed_package (
      capability_version_id TEXT PRIMARY KEY, seller_account_id TEXT NOT NULL,
      draft_id TEXT NOT NULL, graph_hash TEXT NOT NULL, package_hash TEXT NOT NULL,
      package_json TEXT NOT NULL, skills_hash TEXT NOT NULL, skills_json TEXT NOT NULL,
      created_at TEXT NOT NULL);
      CREATE TRIGGER IF NOT EXISTS import_unreviewed_package_no_update
      BEFORE UPDATE ON import_unreviewed_package BEGIN SELECT RAISE(ABORT, 'draft package is immutable'); END;
      CREATE TRIGGER IF NOT EXISTS import_unreviewed_package_no_delete
      BEFORE DELETE ON import_unreviewed_package BEGIN SELECT RAISE(ABORT, 'draft package is immutable'); END;`);
  }
  close(): void { this.db.close(); }

  stage(draft: Readonly<ImportDraft>, prepared: Prepared): { packageHash: string;
    capabilityVersionId: string } {
    const pkg = LocalCapabilityPackageSchema.parse(prepared.localPackage);
    const reviewedSkills = validateReviewedSkillSnapshots(pkg, prepared.reviewedSkills);
    if (hashCanonicalJson(pkg.dependencyGraph) !== draft.graphHash) {
      throw new ImportPackageError('CONFLICT');
    }
    const versionId = pkg.capabilityVersionId;
    const packageHash = hashCanonicalJson(pkg);
    const packageJson = canonicalJson(pkg);
    const skillsJson = canonicalJson(reviewedSkills);
    const skillsHash = hashCanonicalJson(reviewedSkills);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const prior = this.db.prepare(`SELECT seller_account_id,draft_id,graph_hash,package_hash,
        package_json,skills_hash,skills_json FROM import_unreviewed_package
        WHERE capability_version_id=?`).get(versionId) as {
          seller_account_id:string;draft_id:string;graph_hash:string;package_hash:string;
          package_json:string;skills_hash:string;skills_json:string } | undefined;
      if (prior) {
        if (prior.seller_account_id !== draft.sellerAccountId || prior.draft_id !== draft.id ||
          prior.graph_hash !== draft.graphHash || prior.package_hash !== packageHash ||
          prior.package_json !== packageJson || prior.skills_hash !== skillsHash ||
          prior.skills_json !== skillsJson) throw new ImportPackageError('CONFLICT');
      } else {
        this.db.prepare(`INSERT INTO import_unreviewed_package
          (capability_version_id,seller_account_id,draft_id,graph_hash,package_hash,
            package_json,skills_hash,skills_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)`)
          .run(versionId,draft.sellerAccountId,draft.id,draft.graphHash,packageHash,
            packageJson,skillsHash,skillsJson,new Date().toISOString());
      }
      this.db.exec('COMMIT');
      return { capabilityVersionId: versionId, packageHash };
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  load(capabilityVersionId: string, sellerAccountId: string): Prepared {
    const row = this.db.prepare(`SELECT package_json,package_hash,skills_json,skills_hash,
      graph_hash FROM import_unreviewed_package WHERE capability_version_id=?
      AND seller_account_id=?`).get(z.uuid().parse(capabilityVersionId),
      z.uuid().parse(sellerAccountId)) as { package_json:string;package_hash:string;
        skills_json:string;skills_hash:string;graph_hash:string } | undefined;
    if (!row) throw new ImportPackageError('NOT_FOUND');
    try {
      const pkg=LocalCapabilityPackageSchema.parse(JSON.parse(row.package_json));
      const skills=z.array(z.strictObject({name:z.string(),files:z.array(z.strictObject({
        path:z.string(),bytesBase64:z.string()}))})).parse(JSON.parse(row.skills_json));
      if (hashCanonicalJson(pkg)!==row.package_hash ||
        hashCanonicalJson(pkg.dependencyGraph)!==row.graph_hash ||
        hashCanonicalJson(skills)!==row.skills_hash) throw new ImportPackageError('CORRUPT');
      return {localPackage:pkg,reviewedSkills:validateReviewedSkillSnapshots(pkg,skills)};
    } catch { throw new ImportPackageError('CORRUPT'); }
  }
}

/**
 * A draft package is not a reviewed package. It stays local and cannot be
 * installed, offered, or sent as a CAPABILITY_REVIEW until real runtime tests
 * prove its dependency graph and exact bytes.
 */
export async function prepareSelectedPackage(draft: Readonly<ImportDraft>, raw: unknown,
  context: { readonly sellerAccountId: string; readonly workerDeviceId: string },
  discovery: Pick<ReadOnlyOpenClawDiscovery, 'snapshotSelectedSkill'>):
  Promise<{ readonly localPackage: LocalCapabilityPackage;
    readonly reviewedSkills: readonly { name: string;
      files: readonly { path: string; bytesBase64: string }[] }[] }> {
  const input = authoring.parse(raw);
  if (z.uuid().parse(context.sellerAccountId) !== draft.sellerAccountId) {
    throw new ImportPackageError('SELECTION_INCOMPLETE');
  }
  const workerDeviceId=z.uuid().parse(context.workerDeviceId);
  const graph = draft.graph;
  const analysis = analyzeDependencyGraph(graph);
  const unresolvedSelection = analysis.issues.filter((issue) =>
    !['HEALTH_UNKNOWN', 'SUPPORT_UNDETERMINED', 'DEPENDENCY_UNCERTAIN'].includes(issue.code));
  if (unresolvedSelection.length > 0) {
    throw new ImportPackageError('SELECTION_INCOMPLETE');
  }
  const inference = graph.inference;
  if (!inference) {
    throw new ImportPackageError('INFERENCE_MISMATCH');
  }
  const selected = graph.nodes.filter((node) => node.selected);
  const local=inference.mode==='LOCAL';
  const types = ['SKILL', 'AI_PROVIDER', 'AI_MODEL',
    local?'LOCAL_SERVICE':'CREDENTIAL'];
  const databases=selected.filter((node)=>node.type==='DATABASE');
  const apis=selected.filter((node)=>node.type==='PRIVATE_API');
  const localFiles=selected.filter((node)=>node.type==='LOCAL_FILE');
  const localDirectories=selected.filter((node)=>node.type==='LOCAL_DIRECTORY');
  const localSelections=[...localFiles,...localDirectories];
  const declaredConnectors=input.declaredApis?.mode==='DECLARED_API_ACCESS'?
    input.declaredApis.connectors:[];
  const researchTools=selected.filter((node)=>node.type==='TOOL'&&
    ['kivro_research_search','kivro_research_fetch','kivro_research_download']
      .includes(node.name));
  const research=input.publicResearch?.mode==='PUBLIC_WEB_RESEARCH'?
    input.publicResearch:null;
  const expectedResearchTools=research?[
    ...(research.search.enabled?['kivro_research_search']:[]),
    ...(research.fetch.enabled?['kivro_research_fetch']:[]),
    ...(research.download.enabled?['kivro_research_download']:[])]:[];
  if (selected.length !== types.length+databases.length+apis.length+
      localSelections.length+researchTools.length ||
    types.some((type) => selected.filter((node) => node.type === type).length !== 1)||
    databases.length!==input.localResources.length||
    databases.length!==Object.keys(input.databaseCredentialRefs).length||
    apis.length!==declaredConnectors.length||
    localSelections.length!==input.selectedLocalPaths.length||
    new Set(input.selectedLocalPaths.map((item)=>item.resourceId)).size!==
      input.selectedLocalPaths.length||
    input.selectedLocalPaths.some((item)=>!localSelections.some((node)=>
      node.id===item.resourceId))||
    Object.keys(input.apiCredentialRefs).some((id)=>!apis.some((node)=>node.id===id))||
    (input.declaredApis!==undefined&&input.declaredApis.mode!=='DECLARED_API_ACCESS')||
    (input.publicResearch!==undefined&&!research)||
    researchTools.length!==expectedResearchTools.length||
    researchTools.some((node)=>!expectedResearchTools.includes(node.name))||
    new Set(researchTools.map((node)=>node.name)).size!==researchTools.length||
    input.localResources.some((policy)=>!databases.some((node)=>node.id===policy.resourceId))||
    databases.some((node)=>!input.databaseCredentialRefs[node.id])||
    declaredConnectors.some((connector)=>connector.method==='POST'||
      !apis.some((node)=>node.id===connector.id))) {
    throw new ImportPackageError('DEPENDENCY_UNSUPPORTED');
  }
  const root = selected.find((node) => node.id === graph.rootId);
  const model = selected.find((node) => node.id === inference.dependencyId);
  const route = selected.find((node) =>
    node.id===(local?inference.endpointRef:inference.credentialRef));
  const provider = selected.find((node) => node.type === 'AI_PROVIDER');
  if (!root || root.type !== 'SKILL' || !model || model.type !== 'AI_MODEL' ||
    !route||route.type!==(local?'LOCAL_SERVICE':'CREDENTIAL')||!provider||
    Boolean(input.localInference)!==local||Boolean(input.providerBudget)===local||
    (local?input.localInference?.endpointRef!==route.id:
      input.providerBudget?.credentialRef!==route.name)||
    (local?input.localInference?.providerId:input.providerBudget?.providerId)!==
      inference.provider||provider.name!==inference.provider||
    (local?input.localInference?.modelId:input.providerBudget?.modelId)!==
      inference.model||model.name!==inference.model) {
    throw new ImportPackageError('INFERENCE_MISMATCH');
  }
  const skill = await discovery.snapshotSelectedSkill(root.name);
  if (skill.name !== root.name) throw new ImportPackageError('SKILL_CHANGED');
  const selectedLocalBindings=await Promise.all(input.selectedLocalPaths.map((item)=>{
    const node=localSelections.find((candidate)=>candidate.id===item.resourceId)!;
    return captureSelectedLocalBinding({resourceId:item.resourceId,
      kind:node.type==='LOCAL_FILE'?'FILE':'DIRECTORY',
      absolutePath:item.absolutePath});
  }));
  const fileInput = input.ioContract.input.fields.some((field) =>
    field.type === 'FILE' || field.type === 'FILES');
  const packageData = LocalCapabilityPackageSchema.parse({
    packageVersion: 1,
    capabilityId: input.capabilityId,
    capabilityVersionId: input.capabilityVersionId,
    workerDeviceId,
    workerManifest: {
      manifestVersion: 1, workerId: workerDeviceId,
      capabilityVersionId: input.capabilityVersionId,
      runtime: { type: 'openclaw', supportedVersionRange: input.supportedOpenClawVersionRange },
      skills: [{ name: skill.name, contentHash: skill.contentHash }],
      tools: { allow: [
        ...expectedResearchTools,
        ...(databases.length?['kivro_resource_read']:[]),
        ...(apis.length?['kivro_declared_api']:[]),
        ...(selectedLocalBindings.length?['kivro_selected_file_read']:[])], deny: [] },
      resources: [
        ...input.localResources.map((policy)=>({id:policy.resourceId,
          type:'local-resource-broker' as const,
          permissions:policy.operations.map((operation)=>operation.id),
          credentialRef:input.databaseCredentialRefs[policy.resourceId]})),
        ...declaredConnectors.map((connector)=>({id:connector.id,
          type:'declared-api' as const,permissions:[connector.method],
          ...(input.apiCredentialRefs[connector.id]?
            {credentialRef:input.apiCredentialRefs[connector.id]}:{})})),
        ...selectedLocalBindings.map((binding)=>({id:binding.resourceId,
          type:'selected-file' as const,permissions:['READ']})),
      ],
      network: { default: 'deny', allow: [] }, limits: input.limits,
    },
    dependencyGraph: graph,
    permissionPolicy: {
      policyVersion: 1, aiInference: 'SELLER',
      ...(input.providerBudget?{providerBudget:input.providerBudget}:{}),
      ...(input.localInference?{localInference:input.localInference}:{}),
      publicInternet: research?'PUBLIC_RESEARCH_BROKER':
        apis.length?'DECLARED_DOMAINS':'DENY',
      ...(research?{internet:research}:apis.length?{internet:input.declaredApis}:{}),
      ...(research&&apis.length?{declaredApiPolicy:input.declaredApis}:{}),
      browser: false, proprietaryDatabase: databases.length?'READ_ONLY':'NONE',
      privateApi: apis.length?'READ_ONLY':'NONE',
      ...(databases.length?{localResources:input.localResources}:{}),
      selectedFileResourceIds: localFiles.map((node)=>node.id),
      selectedDirectoryResourceIds: localDirectories.map((node)=>node.id),
      localSoftware: false, shell: false, externalSideEffects: false,
      buyerFileAccess: fileInput,
      sellerCredentialRefs: [...new Set([
        ...(input.providerBudget?[input.providerBudget.credentialRef]:[]),
        ...Object.values(input.databaseCredentialRefs),
        ...Object.values(input.apiCredentialRefs)])],
    },
    ...(input.sellerInstructions === undefined ? {} : { sellerInstructions: input.sellerInstructions }),
    sellerInferenceConfigHash: hashCanonicalJson({ inference,
      budget:input.providerBudget??input.localInference }),
    ioContract: input.ioContract,
    priceTier: input.priceTier,
    dependencySnapshot: selected.map((node) => ({ id: node.id,
      version: node.type === 'SKILL' ? 'selected-skill' : 'seller-declared',
      contentHash: node.type === 'SKILL' ? skill.contentHash :
        hashCanonicalJson({ id: node.id, type: node.type, name: node.name }) })),
    ...(selectedLocalBindings.length?{selectedLocalBindings}:{}),
    concurrencyLimit: input.concurrencyLimit,
    pauseSupport: input.pauseSupport,
    exampleRefs: [], testRefs: [],
  });
  return { localPackage: packageData, reviewedSkills: [{ name: skill.name, files: skill.files }] };
}
