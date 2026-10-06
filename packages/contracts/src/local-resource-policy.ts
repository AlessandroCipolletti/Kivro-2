import { z } from 'zod';

const identifier = z.string().regex(/^[a-z_][a-z0-9_]{0,62}$/);
export const ReadOnlyResourceOperationSchema = z.strictObject({
  id: identifier, schema: identifier, table: identifier,
  columns: z.array(identifier).min(1).max(20),
  lookupColumn: identifier, maxRows: z.number().int().min(1).max(100),
  scope: z.strictObject({ column: identifier, value: z.string().min(1).max(160) }).optional(),
});

export const ReadOnlyResourcePolicySchema = z.strictObject({
  resourceId: identifier,
  statementTimeoutMs: z.number().int().min(100).max(5000),
  operations: z.array(ReadOnlyResourceOperationSchema).min(1).max(32),
}).refine((value) => new Set(value.operations.map((op) => op.id)).size === value.operations.length,
  'Duplicate local resource operation');

export type ReadOnlyResourcePolicy = z.infer<typeof ReadOnlyResourcePolicySchema>;
export type ReadOnlyResourceOperation = z.infer<typeof ReadOnlyResourceOperationSchema>;
