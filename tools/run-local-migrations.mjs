import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

const requireFromWeb = createRequire(new URL('../apps/web/package.json', import.meta.url));
const pg = requireFromWeb('pg');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const pool = new pg.Pool({ connectionString: databaseUrl });
const client = await pool.connect();
try {
  await client.query('SELECT pg_advisory_lock(924612)');
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const directory = new URL('../packages/persistence/migrations/', import.meta.url);
  const files = (await readdir(directory)).filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/.test(name)).sort();
  for (const name of files) {
    const existing = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [name]);
    if (existing.rowCount) continue;
    const sql = await readFile(fileURLToPath(new URL(name, directory)), 'utf8');
    if (!/^\s*BEGIN;/.test(sql) || !/COMMIT;\s*$/.test(sql)) {
      throw new Error(`Migration ${name} must be transaction-wrapped`);
    }
    const body = sql.replace(/^\s*BEGIN;\s*/, '').replace(/\s*COMMIT;\s*$/, '');
    try {
      await client.query('BEGIN');
      await client.query(body);
      await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [name]);
      await client.query('COMMIT');
      process.stdout.write(`Applied ${name}\n`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  try { await client.query('SELECT pg_advisory_unlock(924612)'); }
  finally { client.release(); await pool.end(); }
}
