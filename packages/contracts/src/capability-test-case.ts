import { z } from 'zod';
import { CapabilityIOContractSchema } from './capability-io.js';
import { validateInputPayload } from './contract-values.js';

const testPayloadSchema = z.strictObject({
  values: z.record(z.string(), z.unknown()),
  assets: z.record(z.string(), z.array(z.uuid()).max(50)),
});

export const CapabilityTestCaseSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: z.uuid(),
  capabilityVersionId: z.uuid(),
  name: z.string().trim().min(1).max(120),
  input: testPayloadSchema,
  expectedFiles: z.array(z.strictObject({
    fieldKey: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/),
    minFiles: z.number().int().positive().max(50),
    allowedMimeTypes: z.array(z.string().min(3).max(120)).min(1).max(32),
  })).max(64),
  semanticAssertions: z.array(z.string().trim().min(1).max(500)).max(10),
  maxRuntimeSeconds: z.number().int().min(1).max(3600),
  maxInferenceCostMinor: z.number().int().nonnegative().max(1_000_000),
  costCurrency: z.literal('usd'),
});

export type CapabilityTestCase = z.infer<typeof CapabilityTestCaseSchema>;

/** Seller-authored fixtures are private; semantic assertions need explicit review. */
export function parseCapabilityTestCase(raw: unknown, rawContract: unknown): CapabilityTestCase {
  const testCase = CapabilityTestCaseSchema.parse(raw);
  const contract = CapabilityIOContractSchema.parse(rawContract);
  validateInputPayload(contract.input, testCase.input);
  const outputFields = new Map(contract.output.fields.map((field) => [field.key, field]));
  if (new Set(testCase.expectedFiles.map((item) => item.fieldKey)).size !== testCase.expectedFiles.length) {
    throw new TypeError('Duplicate expected file assertion');
  }
  for (const expected of testCase.expectedFiles) {
    const field = outputFields.get(expected.fieldKey);
    if (!field || (field.type !== 'FILE' && field.type !== 'FILES') ||
      expected.minFiles > field.constraints.maxFiles ||
      expected.allowedMimeTypes.some((mime) => !field.constraints.allowedMimeTypes.includes(mime))) {
      throw new TypeError('Expected file assertion contradicts output contract');
    }
  }
  return Object.freeze(testCase);
}
