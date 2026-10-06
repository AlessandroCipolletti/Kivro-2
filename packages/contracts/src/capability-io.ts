import { z } from 'zod';
import { PLATFORM_FILE_LIMITS } from './file-limits.js';

const key = z.string().min(1).max(64).regex(/^[A-Za-z][A-Za-z0-9_]*$/);
const label = z.string().trim().min(1).max(120);
const description = z.string().trim().max(1000).optional();
const condition = z.strictObject({ fieldKey: key, equals: z.union([z.string(), z.number().finite(), z.boolean()]) });
const base = {
  key,
  label,
  description,
  required: z.boolean(),
  order: z.number().int().min(0).max(63),
  group: label.optional(),
  semanticType: z.string().trim().min(1).max(120).optional(),
  visibleWhen: condition.optional(),
};

const textConstraints = z.strictObject({
  minLength: z.number().int().min(0).max(100_000).optional(),
  maxLength: z.number().int().min(1).max(100_000).optional(),
}).refine((v) => v.minLength === undefined || v.maxLength === undefined || v.minLength <= v.maxLength);
const numberConstraints = z.strictObject({
  minimum: z.number().finite().optional(),
  maximum: z.number().finite().optional(),
}).refine((v) => v.minimum === undefined || v.maximum === undefined || v.minimum <= v.maximum);
const choiceConstraints = z.strictObject({
  allowedValues: z.array(z.string().min(1).max(160)).min(1).max(100)
    .refine((v) => new Set(v).size === v.length),
  maxSelections: z.number().int().positive().max(100).optional(),
});
const fileConstraints = z.strictObject({
  minFiles: z.number().int().min(0).max(PLATFORM_FILE_LIMITS.maxFilesPerField).optional(),
  maxFiles: z.number().int().positive().max(PLATFORM_FILE_LIMITS.maxFilesPerField),
  maxFileSizeBytes: z.number().int().positive().max(PLATFORM_FILE_LIMITS.maxSingleFileBytes),
  maxTotalSizeBytes: z.number().int().positive().max(PLATFORM_FILE_LIMITS.maxTotalFieldBytes),
  allowedMimeTypes: z.array(z.string().min(3).max(120)).min(1).max(32),
  allowedExtensions: z.array(z.string().regex(/^\.[A-Za-z0-9]{1,16}$/)).min(1).max(32),
}).refine((v) => (v.minFiles ?? 0) <= v.maxFiles);

const shortText = z.strictObject({ ...base, type: z.literal('SHORT_TEXT'), constraints: textConstraints.optional() });
const longText = z.strictObject({ ...base, type: z.literal('LONG_TEXT'), constraints: textConstraints.optional() });
const integer = z.strictObject({ ...base, type: z.literal('INTEGER'), constraints: numberConstraints.optional() });
const number = z.strictObject({ ...base, type: z.literal('NUMBER'), constraints: numberConstraints.optional() });
const boolean = z.strictObject({ ...base, type: z.literal('BOOLEAN') });
const select = z.strictObject({ ...base, type: z.literal('SELECT'), constraints: choiceConstraints });
const multiSelect = z.strictObject({ ...base, type: z.literal('MULTI_SELECT'), constraints: choiceConstraints });
const url = z.strictObject({ ...base, type: z.literal('URL') });
const json = z.strictObject({ ...base, type: z.literal('JSON'), maxBytes: z.number().int().positive().max(1_048_576) });
const file = z.strictObject({ ...base, type: z.literal('FILE'), constraints: fileConstraints.refine((v) => v.maxFiles === 1) });
const files = z.strictObject({ ...base, type: z.literal('FILES'), constraints: fileConstraints });
const markdown = z.strictObject({ ...base, type: z.literal('MARKDOWN'), constraints: textConstraints.optional() });

export const InputFieldSchema = z.discriminatedUnion('type', [
  shortText.extend({ defaultValue: z.string().optional() }),
  longText.extend({ defaultValue: z.string().optional() }),
  integer.extend({ defaultValue: z.number().int().optional() }),
  number.extend({ defaultValue: z.number().finite().optional() }),
  boolean.extend({ defaultValue: z.boolean().optional() }),
  select.extend({ defaultValue: z.string().optional() }),
  multiSelect, url, json, file, files,
]);
export const OutputFieldSchema = z.discriminatedUnion('type', [
  shortText, longText, markdown, number, boolean, url, json, file, files,
]);

function uniqueFields(fields: readonly { key: string; order: number }[]): boolean {
  return new Set(fields.map((field) => field.key)).size === fields.length &&
    new Set(fields.map((field) => field.order)).size === fields.length;
}

function reachableConditionValue(field: z.infer<typeof InputFieldSchema>,
  expected: string | number | boolean): boolean {
  switch (field.type) {
    case 'BOOLEAN':
      return typeof expected === 'boolean';
    case 'SELECT':
      return typeof expected === 'string' && field.constraints.allowedValues.includes(expected);
    case 'INTEGER':
    case 'NUMBER':
      return typeof expected === 'number' && (field.type !== 'INTEGER' || Number.isInteger(expected)) &&
        expected >= (field.constraints?.minimum ?? -Infinity) &&
        expected <= (field.constraints?.maximum ?? Infinity);
    case 'SHORT_TEXT':
      return typeof expected === 'string' &&
        expected.length >= Math.max(field.required ? 1 : 0, field.constraints?.minLength ?? 0) &&
        expected.length <= (field.constraints?.maxLength ?? 256);
    default:
      return false;
  }
}

export const InputContractSchema = z.strictObject({
  schemaVersion: z.literal(1),
  fields: z.array(InputFieldSchema).min(1).max(64),
}).superRefine((contract, context) => {
  if (!uniqueFields(contract.fields)) context.addIssue({ code: 'custom', message: 'Input field keys and order must be unique' });
  const byKey = new Map(contract.fields.map((field) => [field.key, field]));
  for (const field of contract.fields) {
    const dependency = field.visibleWhen && byKey.get(field.visibleWhen.fieldKey);
    if (field.visibleWhen && (!dependency || dependency.order >= field.order ||
      !reachableConditionValue(dependency, field.visibleWhen.equals))) {
      context.addIssue({ code: 'custom', message: `Invalid visibleWhen for ${field.key}` });
    }
    if ('defaultValue' in field && field.defaultValue !== undefined) {
      const value = field.defaultValue;
      const valid = field.type === 'SELECT' ? field.constraints.allowedValues.includes(value as string) :
        field.type === 'SHORT_TEXT' || field.type === 'LONG_TEXT' ?
          (value as string).length >= Math.max(field.required ? 1 : 0, field.constraints?.minLength ?? 0) &&
          (value as string).length <= (field.constraints?.maxLength ?? (field.type === 'SHORT_TEXT' ? 256 : 10_000)) :
          field.type === 'INTEGER' || field.type === 'NUMBER' ?
            (value as number) >= (field.constraints?.minimum ?? -Infinity) &&
            (value as number) <= (field.constraints?.maximum ?? Infinity) : true;
      if (!valid) context.addIssue({ code: 'custom', message: `Invalid default for ${field.key}` });
    }
  }
});

export const OutputContractSchema = z.strictObject({
  schemaVersion: z.literal(1),
  fields: z.array(OutputFieldSchema).min(1).max(64),
}).superRefine((contract, context) => {
  if (!uniqueFields(contract.fields)) context.addIssue({ code: 'custom', message: 'Output field keys and order must be unique' });
  if (contract.fields.some((field) => field.visibleWhen !== undefined)) {
    context.addIssue({ code: 'custom', message: 'Conditional output fields are not supported' });
  }
});

export const CapabilityIOContractSchema = z.strictObject({
  contractVersion: z.literal(1),
  input: InputContractSchema,
  output: OutputContractSchema,
});

export type InputContract = z.infer<typeof InputContractSchema>;
export type OutputContract = z.infer<typeof OutputContractSchema>;
export type CapabilityIOContract = z.infer<typeof CapabilityIOContractSchema>;
