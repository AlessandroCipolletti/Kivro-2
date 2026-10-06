import type { Pool } from 'pg';
import type { LocalResourceAuditPort } from '../../infrastructure/contracts/src/research-ports.js';

export class PostgresLocalResourceAudit implements LocalResourceAuditPort {
  constructor(private readonly pool: Pool) {}
  async record(input: Parameters<LocalResourceAuditPort['record']>[0]): Promise<void> {
    await this.pool.query(`INSERT INTO local_resource_audit
      (job_id,capability_version_id,resource_id,operation_id,row_count,status,reason,occurred_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [input.jobId, input.capabilityVersionId,
      input.resourceId, input.operationId, input.rowCount, input.status, input.reason, input.occurredAt]);
  }
}
