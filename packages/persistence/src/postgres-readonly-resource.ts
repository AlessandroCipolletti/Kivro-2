import type { Pool } from 'pg';
import type { LocalResourceQueryPort } from '../../infrastructure/contracts/src/research-ports.js';
import { ReadOnlyResourceOperationSchema } from '../../contracts/src/local-resource-policy.js';

const identifier = /^[a-z_][a-z0-9_]{0,62}$/;
function id(value: string): string {
  if (!identifier.test(value)) throw new TypeError('Invalid resource identifier');
  return `"${value}"`;
}

/** Use a dedicated SELECT-only credential and database grants/RLS; never expose this Pool to the sandbox. */
export class PostgresReadOnlyResourceAdapter implements LocalResourceQueryPort {
  constructor(private readonly pool: Pool) {}
  async query(rawOperation: Parameters<LocalResourceQueryPort['query']>[0], lookup: string,
    statementTimeoutMs: number): Promise<readonly Record<string, unknown>[]> {
    const op = ReadOnlyResourceOperationSchema.parse(rawOperation);
    if (lookup.length < 1 || lookup.length > 160 || !Number.isInteger(statementTimeoutMs) ||
      statementTimeoutMs < 100 || statementTimeoutMs > 5000) throw new TypeError('Invalid resource request');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN READ ONLY');
      await client.query('SET LOCAL row_security=on');
      await client.query("SELECT set_config('statement_timeout',$1,true)", [String(statementTimeoutMs)]);
      const role = await client.query<{ rolsuper: boolean; rolbypassrls: boolean; rolcreatedb: boolean;
        rolcreaterole: boolean; rolreplication: boolean; rolinherit: boolean; rolconnlimit: number }>(
        'SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication,rolinherit,rolconnlimit FROM pg_roles WHERE rolname=current_user');
      const r = role.rows[0];
      if (!r || r.rolsuper || r.rolbypassrls || r.rolcreatedb || r.rolcreaterole || r.rolreplication ||
        r.rolinherit || r.rolconnlimit < 1 || r.rolconnlimit > 10) throw new Error('RESOURCE_CREDENTIAL_UNSAFE');
      const grants = await client.query<{ unsafe: boolean }>(`SELECT
        has_database_privilege(current_user,current_database(),'CREATE') OR
        EXISTS (SELECT 1 FROM information_schema.role_table_grants
          WHERE grantee=current_user AND privilege_type <> 'SELECT') AS unsafe`);
      if (grants.rows[0]?.unsafe) throw new Error('RESOURCE_CREDENTIAL_UNSAFE');
      const scope = op.scope ? ` AND ${id(op.scope.column)} = $2` : '';
      const sql = `SELECT ${op.columns.map(id).join(',')} FROM ${id(op.schema)}.${id(op.table)} WHERE ${id(op.lookupColumn)} = $1${scope} LIMIT $${op.scope ? 3 : 2}`;
      const values = op.scope ? [lookup, op.scope.value, op.maxRows] : [lookup, op.maxRows];
      const result = await client.query<Record<string, unknown>>(sql, values);
      await client.query('COMMIT');
      return result.rows;
    } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; }
    finally { client.release(); }
  }
}
