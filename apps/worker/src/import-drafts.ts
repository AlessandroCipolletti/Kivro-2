import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import { canonicalJson, hashCanonicalJson } from '../../../packages/contracts/src/canonical-json.js';
import { DependencyGraphSchema, PermissionConsentSchema,
  type DependencyGraph, type PermissionConsent } from '../../../packages/contracts/src/dependency-graph.js';
import { applySellerSelection } from '../../../packages/domain/src/dependency-graph.js';
import { openPrivateWorkerSqlite } from './local-state.js';

const uuid = z.uuid();
const selection = z.strictObject({
  actionId: uuid, draftId: uuid, sellerAccountId: uuid,
  dependencyId: DependencyGraphSchema.shape.rootId,
  selected: z.boolean(), expectedRevision: z.number().int().nonnegative(),
  actedAt: z.iso.datetime(),
});
const reference = z.string().min(1).max(160).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const inferenceAction = z.discriminatedUnion('mode', [
  z.strictObject({ actionId: uuid, draftId: uuid, sellerAccountId: uuid,
    expectedRevision: z.number().int().nonnegative(), actedAt: z.iso.datetime(),
    mode: z.literal('REMOTE_PROVIDER'), provider: reference, model: z.string().min(1).max(160),
    credentialRef: reference }),
  z.strictObject({ actionId: uuid, draftId: uuid, sellerAccountId: uuid,
    expectedRevision: z.number().int().nonnegative(), actedAt: z.iso.datetime(),
    mode: z.literal('LOCAL'), provider: reference, model: z.string().min(1).max(160),
    endpointRef: reference }),
]);

const schema = `
CREATE TABLE IF NOT EXISTS import_drafts (
  id TEXT PRIMARY KEY,
  seller_account_id TEXT NOT NULL,
  graph_json TEXT NOT NULL,
  initial_graph_hash TEXT NOT NULL,
  graph_hash TEXT NOT NULL CHECK (graph_hash GLOB 'sha256:*'),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS import_selection_actions (
  action_id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES import_drafts(id) ON DELETE RESTRICT,
  seller_account_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  resulting_graph_json TEXT NOT NULL,
  resulting_revision INTEGER NOT NULL CHECK (resulting_revision > 0),
  resulting_updated_at TEXT NOT NULL,
  acted_at TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS import_selection_no_update BEFORE UPDATE ON import_selection_actions
  BEGIN SELECT RAISE(ABORT, 'import selection is append-only'); END;
CREATE TRIGGER IF NOT EXISTS import_selection_no_delete BEFORE DELETE ON import_selection_actions
  BEGIN SELECT RAISE(ABORT, 'import selection is append-only'); END;
CREATE TABLE IF NOT EXISTS import_inference_actions (
  action_id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES import_drafts(id) ON DELETE RESTRICT,
  seller_account_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  resulting_graph_json TEXT NOT NULL,
  resulting_revision INTEGER NOT NULL CHECK (resulting_revision > 0),
  resulting_updated_at TEXT NOT NULL,
  acted_at TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS import_inference_no_update BEFORE UPDATE ON import_inference_actions
  BEGIN SELECT RAISE(ABORT, 'inference choice is append-only'); END;
CREATE TRIGGER IF NOT EXISTS import_inference_no_delete BEFORE DELETE ON import_inference_actions
  BEGIN SELECT RAISE(ABORT, 'inference choice is append-only'); END;
CREATE TABLE IF NOT EXISTS import_permission_consents (
  id TEXT PRIMARY KEY,
  seller_account_id TEXT NOT NULL,
  capability_version_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  recorded_at TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS import_consent_no_update BEFORE UPDATE ON import_permission_consents
  BEGIN SELECT RAISE(ABORT, 'permission consent is append-only'); END;
CREATE TRIGGER IF NOT EXISTS import_consent_no_delete BEFORE DELETE ON import_permission_consents
  BEGIN SELECT RAISE(ABORT, 'permission consent is append-only'); END;
`;

type DraftRow = {
  id: string; seller_account_id: string; graph_json: string; initial_graph_hash: string; graph_hash: string;
  revision: number; created_at: string; updated_at: string;
};
type ActionRow = { request_hash: string; resulting_graph_json: string; resulting_revision: number; resulting_updated_at: string };
type ConsentRow = { payload_json: string; payload_hash: string };

function inferenceNodeId(type: string, name: string): string {
  return `dep:inference:${type}:${createHash('sha256').update(name).digest('hex').slice(0, 24)}`;
}

/** Seller declaration adds candidates only. It cannot select, authorize or test an inference resource. */
function withInferenceCandidates(graph: DependencyGraph,
  action: z.infer<typeof inferenceAction>): DependencyGraph {
  if (graph.inference !== null) throw new ImportDraftError('CONFLICT', 'Inference is already configured; start a new draft to change it');
  const root = graph.nodes.find((node) => node.id === graph.rootId);
  if (!root) throw new ImportDraftError('INVALID_ARGUMENT', 'Draft root is missing');
  const modelId = inferenceNodeId('model', `${action.provider}\0${action.model}`);
  const providerId = inferenceNodeId('provider', action.provider);
  const endpointId = action.mode === 'LOCAL' ? inferenceNodeId('endpoint', action.endpointRef) : null;
  const credentialId = action.mode === 'REMOTE_PROVIDER' ? inferenceNodeId('credential', action.credentialRef) : null;
  const ids = [modelId, providerId, endpointId, credentialId].filter((value): value is string => value !== null);
  if (ids.some((id) => graph.nodes.some((node) => node.id === id))) {
    throw new ImportDraftError('CONFLICT', 'Inference dependency collides with existing draft');
  }
  const candidate = (id: string, type: 'AI_PROVIDER' | 'AI_MODEL' | 'CREDENTIAL' | 'LOCAL_SERVICE',
    name: string, dependsOn: string[]) => ({ id, type, name, requirement: 'REQUIRED' as const,
    sensitivity: type === 'CREDENTIAL' ? 'HIGH' as const : 'MEDIUM' as const,
    discoveredFrom: ['SELLER_DECLARATION' as const], dependsOn,
    marketplaceSupport: 'UNDETERMINED' as const, confidence: 'UNKNOWN' as const,
    selected: false, health: 'UNKNOWN' as const });
  const dependency = endpointId ?? credentialId;
  if (!dependency) throw new ImportDraftError('INVALID_ARGUMENT', 'Inference route is incomplete');
  return DependencyGraphSchema.parse({ ...graph,
    inference: action.mode === 'REMOTE_PROVIDER'
      ? { mode: action.mode, dependencyId: modelId, provider: action.provider,
        model: action.model, credentialRef: credentialId, billingOwner: 'SELLER' }
      : { mode: action.mode, dependencyId: modelId, provider: action.provider,
        model: action.model, endpointRef: endpointId, billingOwner: 'SELLER' },
    nodes: [ ...graph.nodes.map((node) => node.id === graph.rootId
      ? { ...node, dependsOn: [...node.dependsOn, modelId] } : node),
      candidate(providerId, 'AI_PROVIDER', action.provider, []),
      candidate(modelId, 'AI_MODEL', action.model, [providerId, dependency]),
      action.mode === 'REMOTE_PROVIDER'
        ? candidate(credentialId!, 'CREDENTIAL', action.credentialRef, [])
        : candidate(endpointId!, 'LOCAL_SERVICE', action.endpointRef, []),
    ],
  });
}

export interface ImportDraft {
  readonly id: string;
  readonly sellerAccountId: string;
  readonly graph: Readonly<DependencyGraph>;
  readonly graphHash: string;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export class ImportDraftError extends Error {
  constructor(readonly code: 'NOT_FOUND' | 'CONFLICT' | 'INVALID_ARGUMENT', message: string) {
    super(message);
    this.name = 'ImportDraftError';
  }
}

function freezeDeep<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) freezeDeep(nested);
    Object.freeze(value);
  }
  return value;
}

function toDraft(row: DraftRow): Readonly<ImportDraft> {
  return freezeDeep({ id: row.id, sellerAccountId: row.seller_account_id,
    graph: DependencyGraphSchema.parse(JSON.parse(row.graph_json)), graphHash: row.graph_hash,
    revision: row.revision, createdAt: row.created_at, updatedAt: row.updated_at });
}

/** Seller-local draft store. Discovery metadata and unselected candidates never need cloud persistence. */
export class SellerImportDraftStore {
  private readonly db: DatabaseSync;

  constructor(stateDir: string) {
    this.db = openPrivateWorkerSqlite(stateDir, 'import.sqlite');
    try { this.db.exec(schema); }
    catch (error) { this.db.close(); throw error; }
  }

  close(): void { this.db.close(); }

  createDraft(id: string, sellerAccountId: string, rawGraph: unknown): Readonly<ImportDraft> {
    uuid.parse(id); uuid.parse(sellerAccountId);
    const graph = DependencyGraphSchema.parse(rawGraph);
    if (graph.nodes.some((node) => node.selected) || graph.inference !== null) {
      throw new ImportDraftError('INVALID_ARGUMENT', 'Imported discovery cannot carry preselected permissions or inference');
    }
    const graphJson = canonicalJson(graph);
    const graphHash = hashCanonicalJson(graph);
    const now = new Date().toISOString();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const existing = this.db.prepare('SELECT * FROM import_drafts WHERE id = ?').get(id) as DraftRow | undefined;
      if (existing) {
        if (existing.seller_account_id !== sellerAccountId || existing.initial_graph_hash !== graphHash) {
          throw new ImportDraftError('CONFLICT', 'Draft identifier already belongs to different content');
        }
        this.db.exec('COMMIT');
        return toDraft(existing);
      }
      this.db.prepare(`INSERT INTO import_drafts(id,seller_account_id,graph_json,initial_graph_hash,graph_hash,revision,created_at,updated_at)
        VALUES (?,?,?,?,?,0,?,?)`).run(id, sellerAccountId, graphJson, graphHash, graphHash, now, now);
      this.db.exec('COMMIT');
      return toDraft({ id, seller_account_id: sellerAccountId, graph_json: graphJson,
        initial_graph_hash: graphHash, graph_hash: graphHash,
        revision: 0, created_at: now, updated_at: now });
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  getDraft(id: string, sellerAccountId: string): Readonly<ImportDraft> {
    uuid.parse(id); uuid.parse(sellerAccountId);
    const row = this.db.prepare('SELECT * FROM import_drafts WHERE id = ? AND seller_account_id = ?')
      .get(id, sellerAccountId) as DraftRow | undefined;
    if (!row) throw new ImportDraftError('NOT_FOUND', 'Draft not found');
    return toDraft(row);
  }

  applySelection(rawAction: unknown): Readonly<ImportDraft> {
    const action = selection.parse(rawAction);
    const requestHash = hashCanonicalJson(action);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const prior = this.db.prepare('SELECT * FROM import_selection_actions WHERE action_id = ?')
        .get(action.actionId) as ActionRow | undefined;
      if (prior) {
        if (prior.request_hash !== requestHash) throw new ImportDraftError('CONFLICT', 'Selection action identifier was reused');
        const current = this.db.prepare('SELECT * FROM import_drafts WHERE id = ? AND seller_account_id = ?')
          .get(action.draftId, action.sellerAccountId) as DraftRow | undefined;
        if (!current) throw new ImportDraftError('NOT_FOUND', 'Draft not found');
        this.db.exec('COMMIT');
        return toDraft({ ...current, graph_json: prior.resulting_graph_json,
          graph_hash: hashCanonicalJson(JSON.parse(prior.resulting_graph_json)),
          revision: prior.resulting_revision, updated_at: prior.resulting_updated_at });
      }
      const current = this.db.prepare('SELECT * FROM import_drafts WHERE id = ? AND seller_account_id = ?')
        .get(action.draftId, action.sellerAccountId) as DraftRow | undefined;
      if (!current) throw new ImportDraftError('NOT_FOUND', 'Draft not found');
      if (current.revision !== action.expectedRevision) throw new ImportDraftError('CONFLICT', 'Draft revision changed');
      const nextGraph = applySellerSelection(JSON.parse(current.graph_json), {
        sellerAccountId: action.sellerAccountId, dependencyId: action.dependencyId,
        selected: action.selected, actedAt: action.actedAt, source: 'SELLER_ACTION',
      });
      const graphJson = canonicalJson(nextGraph);
      const graphHash = hashCanonicalJson(nextGraph);
      const revision = current.revision + 1;
      const now = new Date().toISOString();
      this.db.prepare('UPDATE import_drafts SET graph_json=?, graph_hash=?, revision=?, updated_at=? WHERE id=?')
        .run(graphJson, graphHash, revision, now, action.draftId);
      this.db.prepare(`INSERT INTO import_selection_actions
        (action_id,draft_id,seller_account_id,request_hash,resulting_graph_json,resulting_revision,resulting_updated_at,acted_at)
        VALUES (?,?,?,?,?,?,?,?)`).run(action.actionId, action.draftId, action.sellerAccountId,
        requestHash, graphJson, revision, now, action.actedAt);
      this.db.exec('COMMIT');
      return toDraft({ ...current, graph_json: graphJson, graph_hash: graphHash, revision, updated_at: now });
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  configureInference(rawAction: unknown): Readonly<ImportDraft> {
    const action = inferenceAction.parse(rawAction);
    const requestHash = hashCanonicalJson(action);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const prior = this.db.prepare('SELECT * FROM import_inference_actions WHERE action_id = ?')
        .get(action.actionId) as ActionRow | undefined;
      const current = this.db.prepare('SELECT * FROM import_drafts WHERE id = ? AND seller_account_id = ?')
        .get(action.draftId, action.sellerAccountId) as DraftRow | undefined;
      if (!current) throw new ImportDraftError('NOT_FOUND', 'Draft not found');
      if (prior) {
        if (prior.request_hash !== requestHash) throw new ImportDraftError('CONFLICT', 'Inference action identifier was reused');
        this.db.exec('COMMIT');
        return toDraft({ ...current, graph_json: prior.resulting_graph_json,
          graph_hash: hashCanonicalJson(JSON.parse(prior.resulting_graph_json)),
          revision: prior.resulting_revision, updated_at: prior.resulting_updated_at });
      }
      if (current.revision !== action.expectedRevision) throw new ImportDraftError('CONFLICT', 'Draft revision changed');
      const nextGraph = withInferenceCandidates(DependencyGraphSchema.parse(JSON.parse(current.graph_json)), action);
      const graphJson = canonicalJson(nextGraph), graphHash = hashCanonicalJson(nextGraph);
      const revision = current.revision + 1, now = new Date().toISOString();
      this.db.prepare('UPDATE import_drafts SET graph_json=?,graph_hash=?,revision=?,updated_at=? WHERE id=?')
        .run(graphJson, graphHash, revision, now, action.draftId);
      this.db.prepare(`INSERT INTO import_inference_actions(action_id,draft_id,seller_account_id,
        request_hash,resulting_graph_json,resulting_revision,resulting_updated_at,acted_at)
        VALUES(?,?,?,?,?,?,?,?)`).run(action.actionId, action.draftId, action.sellerAccountId,
        requestHash, graphJson, revision, now, action.actedAt);
      this.db.exec('COMMIT');
      return toDraft({ ...current, graph_json: graphJson, graph_hash: graphHash, revision, updated_at: now });
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  recordConsent(id: string, sellerAccountId: string, rawConsent: unknown): Readonly<PermissionConsent> {
    uuid.parse(id); uuid.parse(sellerAccountId);
    const consent = PermissionConsentSchema.parse(rawConsent);
    if (consent.sellerAccountId !== sellerAccountId) throw new ImportDraftError('NOT_FOUND', 'Consent owner mismatch');
    const payload = canonicalJson(consent);
    const payloadHash = hashCanonicalJson(consent);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const prior = this.db.prepare('SELECT * FROM import_permission_consents WHERE id = ?')
        .get(id) as ConsentRow | undefined;
      if (prior) {
        if (prior.payload_hash !== payloadHash) throw new ImportDraftError('CONFLICT', 'Consent identifier was reused');
      } else {
        this.db.prepare(`INSERT INTO import_permission_consents
          (id,seller_account_id,capability_version_id,payload_json,payload_hash,recorded_at)
          VALUES (?,?,?,?,?,?)`).run(id, sellerAccountId, consent.capabilityVersionId,
          payload, payloadHash, new Date().toISOString());
      }
      this.db.exec('COMMIT');
      return freezeDeep(consent);
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  consentsForVersion(sellerAccountId: string, capabilityVersionId: string): readonly Readonly<PermissionConsent>[] {
    uuid.parse(sellerAccountId); uuid.parse(capabilityVersionId);
    const rows = this.db.prepare(`SELECT payload_json FROM import_permission_consents
      WHERE seller_account_id = ? AND capability_version_id = ? ORDER BY recorded_at, id`)
      .all(sellerAccountId, capabilityVersionId) as { payload_json: string }[];
    return freezeDeep(rows.map((row) => PermissionConsentSchema.parse(JSON.parse(row.payload_json))));
  }
}
