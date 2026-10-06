import { z } from 'zod';
import {
  InputContractSchema,
  OutputContractSchema,
  type InputContract,
  type OutputContract,
} from './capability-io.js';

const payloadSchema = z.strictObject({
  values: z.record(z.string(), z.unknown()),
  assets: z.record(z.string(), z.array(z.uuid()).max(50)),
});

export interface ContractPayload {
  readonly values: Readonly<Record<string, unknown>>;
  readonly assets: Readonly<Record<string, readonly string[]>>;
}

export type ContractErrorCode =
  | 'INVALID_CONTRACT' | 'INVALID_PAYLOAD' | 'UNKNOWN_FIELD' | 'MISSING_FIELD'
  | 'HIDDEN_FIELD' | 'INVALID_VALUE' | 'INVALID_ASSET_REFERENCE';

export class ContractValidationError extends Error {
  constructor(readonly code: ContractErrorCode, readonly field?: string) {
    super(field ? `${code}: ${field}` : code);
    this.name = 'ContractValidationError';
  }
}

type Field = InputContract['fields'][number] | OutputContract['fields'][number];

function isFileField(field: Field): boolean {
  return field.type === 'FILE' || field.type === 'FILES';
}

function copyJson(value: unknown, maxBytes: number): unknown {
  const seen = new Set<object>();
  function visit(item: unknown, depth: number): void {
    if (depth > 8) throw new Error('JSON depth limit');
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return;
    if (typeof item === 'number' && Number.isFinite(item)) return;
    if (typeof item !== 'object') throw new Error('Invalid JSON value');
    if (seen.has(item)) throw new Error('Cyclic JSON value');
    seen.add(item);
    if (Array.isArray(item)) {
      if (item.length > 256) throw new Error('JSON array limit');
      for (const child of item) visit(child, depth + 1);
    } else {
      const prototype = Object.getPrototypeOf(item);
      if (prototype !== Object.prototype && prototype !== null) throw new Error('Invalid JSON object');
      const entries = Object.entries(item);
      if (entries.length > 256) throw new Error('JSON object limit');
      for (const [key, child] of entries) {
        if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Unsafe JSON key');
        visit(child, depth + 1);
      }
    }
    seen.delete(item);
  }
  if (value === null || typeof value !== 'object') throw new Error('JSON field must be an object or array');
  visit(value, 0);
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, 'utf8') > maxBytes) throw new Error('JSON byte limit');
  return JSON.parse(serialized) as unknown;
}

function validateScalar(field: Field, value: unknown): unknown {
  switch (field.type) {
    case 'SHORT_TEXT':
    case 'LONG_TEXT':
    case 'MARKDOWN': {
      if (typeof value !== 'string') break;
      const defaultMax = field.type === 'SHORT_TEXT' ? 256 : 10_000;
      const min = Math.max(field.required ? 1 : 0, field.constraints?.minLength ?? 0);
      const max = field.constraints?.maxLength ?? defaultMax;
      if (value.length >= min && value.length <= max) return value;
      break;
    }
    case 'INTEGER':
    case 'NUMBER': {
      if (typeof value !== 'number' || !Number.isFinite(value)) break;
      if (field.type === 'INTEGER' && !Number.isInteger(value)) break;
      if (value < (field.constraints?.minimum ?? -Infinity) || value > (field.constraints?.maximum ?? Infinity)) break;
      return value;
    }
    case 'BOOLEAN':
      if (typeof value === 'boolean') return value;
      break;
    case 'SELECT':
      if (typeof value === 'string' && field.constraints.allowedValues.includes(value)) return value;
      break;
    case 'MULTI_SELECT':
      if (Array.isArray(value) && value.length >= (field.required ? 1 : 0) &&
        value.length <= (field.constraints.maxSelections ?? field.constraints.allowedValues.length) &&
        new Set(value).size === value.length && value.every((item) => typeof item === 'string' && field.constraints.allowedValues.includes(item))) return [...value];
      break;
    case 'URL':
      if (typeof value !== 'string' || value.length > 2048) break;
      try {
        const url = new URL(value);
        if (['http:', 'https:'].includes(url.protocol) && url.username === '' && url.password === '') return value;
      } catch { /* invalid URL */ }
      break;
    case 'JSON':
      try { return copyJson(value, field.maxBytes); } catch { break; }
    case 'FILE':
    case 'FILES':
      break;
  }
  throw new ContractValidationError('INVALID_VALUE', field.key);
}

function validatePayload(fields: readonly Field[], input: unknown): ContractPayload {
  const parsed = payloadSchema.safeParse(input);
  if (!parsed.success) throw new ContractValidationError('INVALID_PAYLOAD');
  const { values, assets } = parsed.data;
  const byKey = new Map(fields.map((field) => [field.key, field]));
  for (const key of Object.keys(values)) {
    const field = byKey.get(key);
    if (!field || isFileField(field)) throw new ContractValidationError('UNKNOWN_FIELD', key);
  }
  for (const key of Object.keys(assets)) {
    const field = byKey.get(key);
    if (!field || !isFileField(field)) throw new ContractValidationError('UNKNOWN_FIELD', key);
  }
  const acceptedValues: Record<string, unknown> = Object.create(null);
  const acceptedAssets: Record<string, string[]> = Object.create(null);
  for (const field of [...fields].sort((a, b) => a.order - b.order)) {
    const supplied = isFileField(field) ? Object.hasOwn(assets, field.key) : Object.hasOwn(values, field.key);
    const visible = !field.visibleWhen || acceptedValues[field.visibleWhen.fieldKey] === field.visibleWhen.equals;
    if (!visible) {
      if (supplied) throw new ContractValidationError('HIDDEN_FIELD', field.key);
      continue;
    }
    if (!supplied) {
      if ('defaultValue' in field && field.defaultValue !== undefined) {
        acceptedValues[field.key] = validateScalar(field, field.defaultValue);
        continue;
      }
      if (field.required) throw new ContractValidationError('MISSING_FIELD', field.key);
      continue;
    }
    if (field.type === 'FILE' || field.type === 'FILES') {
      const references = assets[field.key];
      if (!references || new Set(references).size !== references.length ||
        references.length < Math.max(field.required ? 1 : 0, field.constraints.minFiles ?? 0) ||
        references.length > field.constraints.maxFiles ||
        (field.type === 'FILE' && references.length !== 1)) {
        throw new ContractValidationError('INVALID_ASSET_REFERENCE', field.key);
      }
      acceptedAssets[field.key] = [...references];
    } else {
      acceptedValues[field.key] = validateScalar(field, values[field.key]);
    }
  }
  return { values: acceptedValues, assets: acceptedAssets };
}

export function validateInputPayload(contract: unknown, payload: unknown): ContractPayload {
  const parsed = InputContractSchema.safeParse(contract);
  if (!parsed.success) throw new ContractValidationError('INVALID_CONTRACT');
  return validatePayload(parsed.data.fields, payload);
}

export function validateOutputPayload(contract: unknown, payload: unknown): ContractPayload {
  const parsed = OutputContractSchema.safeParse(contract);
  if (!parsed.success) throw new ContractValidationError('INVALID_CONTRACT');
  return validatePayload(parsed.data.fields, payload);
}
