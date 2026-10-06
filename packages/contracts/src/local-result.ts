import { z } from 'zod';

const outputPath = z.string().min(1).max(512);
const scalar = z.strictObject({ type: z.enum(['SHORT_TEXT', 'LONG_TEXT', 'MARKDOWN', 'JSON', 'NUMBER', 'BOOLEAN', 'URL']), value: z.unknown() });
const oneFile = z.strictObject({ type: z.literal('FILE'), path: outputPath });
const manyFiles = z.strictObject({ type: z.literal('FILES'), paths: z.array(outputPath).min(1).max(50) });

/** Local paths are consumed only by the stopped Worker attempt's output collector. */
export const LocalResultManifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  fields: z.record(z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/),
    z.union([scalar, oneFile, manyFiles])),
});

export type LocalResultManifest = z.infer<typeof LocalResultManifestSchema>;

/** Conservative portable names prevent traversal, hidden/special paths and shell ambiguity. */
export function canonicalOutputPath(raw: string): string {
  if (raw.length === 0 || raw.length > 512 || raw.includes('\\') || raw.includes('\0') || raw.startsWith('/')) {
    throw new TypeError('Invalid output path');
  }
  const parts = raw.split('/');
  if (parts.length > 8 || parts.some((part) => !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(part) ||
    part === '.' || part === '..')) throw new TypeError('Invalid output path');
  if (parts.length === 1 && parts[0] === 'result.json') throw new TypeError('Result manifest cannot be a deliverable');
  return parts.join('/');
}

export function parseLocalResultManifest(raw: unknown, maxBytes = 262_144): LocalResultManifest {
  const size = Buffer.byteLength(JSON.stringify(raw), 'utf8');
  if (size > maxBytes) throw new TypeError('Result manifest exceeds limit');
  const manifest = LocalResultManifestSchema.parse(raw);
  const allPaths = new Set<string>();
  for (const value of Object.values(manifest.fields)) {
    const paths = value.type === 'FILE' ? [value.path] : value.type === 'FILES' ? value.paths : [];
    for (const path of paths.map(canonicalOutputPath)) {
      if (allPaths.has(path)) throw new TypeError('Duplicate output file');
      allPaths.add(path);
    }
  }
  return manifest;
}
