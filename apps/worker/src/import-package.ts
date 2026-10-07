import { z } from 'zod';
import type { DatabaseSync } from 'node:sqlite';
import { canonicalJson, hashCanonicalJson } from '../../../packages/contracts/src/canonical-json.js';
import { LocalCapabilityPackageSchema, type LocalCapabilityPackage } from
  '../../../packages/contracts/src/capability-package.js';
import { CapabilityIOContractSchema } from '../../../packages/contracts/src/capability-io.js';
import { PriceTierSchema } from '../../../packages/contracts/src/pricing.js';
import { ProviderBudgetPolicySchema } from '../../../packages/contracts/src/provider-budget-policy.js';
import { WorkerManifestSchema } from '../../../packages/contracts/src/worker-manifest.js';
import { PauseSupportSchema } from '../../../packages/contracts/src/job-control.js';
import { analyzeDependencyGraph } from '../../../packages/domain/src/dependency-graph.js';
import type { ImportDraft } from './import-drafts.js';
import type { ReadOnlyOpenClawDiscovery } from
  '../../../packages/openclaw-adapter/src/read-only-discovery.js';
import { openPrivateWorkerSqlite } from './local-state.js';
import { validateReviewedSkillSnapshots } from './capability-package-store.js';

const authoring = z.strictObject({
  capabilityId: z.uuid(), capabilityVersionId: z.uuid(),
  supportedOpenClawVersionRange: z.string().min(1).max(120),
  ioContract: CapabilityIOContractSchema,
  priceTier: PriceTierSchema,
  providerBudget: ProviderBudgetPolicySchema,
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
  if (!inference || inference.mode !== 'REMOTE_PROVIDER') {
    throw new ImportPackageError('INFERENCE_MISMATCH');
  }
  const selected = graph.nodes.filter((node) => node.selected);
  const types = ['SKILL', 'AI_PROVIDER', 'AI_MODEL', 'CREDENTIAL'];
  if (selected.length !== types.length ||
    types.some((type) => selected.filter((node) => node.type === type).length !== 1)) {
    throw new ImportPackageError('DEPENDENCY_UNSUPPORTED');
  }
  const root = selected.find((node) => node.id === graph.rootId);
  const model = selected.find((node) => node.id === inference.dependencyId);
  const credential = selected.find((node) => node.id === inference.credentialRef);
  const provider = selected.find((node) => node.type === 'AI_PROVIDER');
  if (!root || root.type !== 'SKILL' || !model || model.type !== 'AI_MODEL' ||
    !credential || credential.type !== 'CREDENTIAL' || !provider ||
    input.providerBudget.providerId !== inference.provider ||
    input.providerBudget.providerId !== provider.name ||
    input.providerBudget.modelId !== inference.model ||
    input.providerBudget.modelId !== model.name ||
    input.providerBudget.credentialRef !== credential.name) {
    throw new ImportPackageError('INFERENCE_MISMATCH');
  }
  const skill = await discovery.snapshotSelectedSkill(root.name);
  if (skill.name !== root.name) throw new ImportPackageError('SKILL_CHANGED');
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
      tools: { allow: [], deny: [] }, resources: [],
      network: { default: 'deny', allow: [] }, limits: input.limits,
    },
    dependencyGraph: graph,
    permissionPolicy: {
      policyVersion: 1, aiInference: 'SELLER', providerBudget: input.providerBudget,
      publicInternet: 'DENY', browser: false, proprietaryDatabase: 'NONE',
      privateApi: 'NONE', selectedFileResourceIds: [], selectedDirectoryResourceIds: [],
      localSoftware: false, shell: false, externalSideEffects: false,
      buyerFileAccess: fileInput,
      sellerCredentialRefs: [input.providerBudget.credentialRef],
    },
    ...(input.sellerInstructions === undefined ? {} : { sellerInstructions: input.sellerInstructions }),
    sellerInferenceConfigHash: hashCanonicalJson({ inference, providerBudget: input.providerBudget }),
    ioContract: input.ioContract,
    priceTier: input.priceTier,
    dependencySnapshot: selected.map((node) => ({ id: node.id,
      version: node.type === 'SKILL' ? 'selected-skill' : 'seller-declared',
      contentHash: node.type === 'SKILL' ? skill.contentHash :
        hashCanonicalJson({ id: node.id, type: node.type, name: node.name }) })),
    concurrencyLimit: input.concurrencyLimit,
    pauseSupport: input.pauseSupport,
    exampleRefs: [], testRefs: [],
  });
  return { localPackage: packageData, reviewedSkills: [{ name: skill.name, files: skill.files }] };
}
