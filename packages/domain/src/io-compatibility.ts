import { InputFieldSchema, OutputFieldSchema, type CapabilityIOContract } from '../../contracts/src/capability-io.js';
import { CapabilityIOContractSchema } from '../../contracts/src/capability-io.js';
import { SUPPORTED_FILE_TYPES } from '../../contracts/src/file-types.js';
import { hashCanonicalJson } from '../../contracts/src/canonical-json.js';

type InputField = ReturnType<typeof InputFieldSchema.parse>;
type OutputField = ReturnType<typeof OutputFieldSchema.parse>;
export type MappingStatus = 'DIRECT' | 'SAFE_TEXT_MAPPING' | 'REVIEW_REQUIRED' | 'INCOMPATIBLE';

export interface FieldMappingDecision {
  readonly status: MappingStatus;
  readonly code: string;
}

function textLimits(field: Extract<InputField | OutputField, { type: 'SHORT_TEXT' | 'LONG_TEXT' | 'MARKDOWN' }>):
  { min: number; max: number } {
  return { min: Math.max(field.required ? 1 : 0, field.constraints?.minLength ?? 0),
    max: field.constraints?.maxLength ?? (field.type === 'SHORT_TEXT' ? 256 : 10_000) };
}

function supportedPairs(field: Extract<InputField | OutputField, { type: 'FILE' | 'FILES' }>): Set<string> | null {
  const pairs = new Set<string>();
  for (const mime of field.constraints.allowedMimeTypes) {
    const format = SUPPORTED_FILE_TYPES.find((candidate) => candidate.mime === mime);
    if (!format) return null;
    for (const extension of field.constraints.allowedExtensions) {
      if (format.extensions.some((candidate) => candidate === extension.toLowerCase())) {
        pairs.add(`${mime}:${extension.toLowerCase()}`);
      }
    }
  }
  if (!pairs.size) return null;
  for (const extension of field.constraints.allowedExtensions) {
    if (![...pairs].some((pair) => pair.endsWith(`:${extension.toLowerCase()}`))) return null;
  }
  return pairs;
}

/** Deterministic chain validation; semantic matching can only tighten a structurally safe mapping. */
export function assessFieldMapping(rawOutputField: unknown, rawInputField: unknown): FieldMappingDecision {
  const output = OutputFieldSchema.parse(rawOutputField);
  const input = InputFieldSchema.parse(rawInputField);
  if (input.visibleWhen) return { status: 'REVIEW_REQUIRED', code: 'CONDITIONAL_TARGET' };
  if (!output.required && input.required) return { status: 'INCOMPATIBLE', code: 'OPTIONAL_SOURCE' };
  let status: MappingStatus = 'INCOMPATIBLE';
  let code = 'TYPE_MISMATCH';
  if (output.type === 'FILE' || output.type === 'FILES') {
    if (input.type !== 'FILE' && input.type !== 'FILES') return { status, code };
    const sourcePairs = supportedPairs(output);
    const targetPairs = supportedPairs(input);
    if (!sourcePairs || !targetPairs) return { status: 'REVIEW_REQUIRED', code: 'UNVERIFIED_FORMAT' };
    if ([...sourcePairs].some((pair) => !targetPairs.has(pair))) return { status, code: 'FORMAT_NARROWING' };
    const sourceMin = Math.max(output.required ? 1 : 0, output.constraints.minFiles ?? 0);
    const targetMin = Math.max(input.required ? 1 : 0, input.constraints.minFiles ?? 0);
    if (sourceMin < targetMin || output.constraints.maxFiles > input.constraints.maxFiles ||
      (output.type === 'FILES' && input.type === 'FILE') ||
      output.constraints.maxFileSizeBytes > input.constraints.maxFileSizeBytes ||
      output.constraints.maxTotalSizeBytes > input.constraints.maxTotalSizeBytes) {
      return { status, code: 'CARDINALITY_OR_SIZE' };
    }
    status = 'DIRECT'; code = 'FILE_SAFE';
  } else if (['SHORT_TEXT', 'LONG_TEXT', 'MARKDOWN'].includes(output.type) &&
    ['SHORT_TEXT', 'LONG_TEXT', 'MARKDOWN'].includes(input.type)) {
    const source = textLimits(output as Extract<OutputField, { type: 'SHORT_TEXT' | 'LONG_TEXT' | 'MARKDOWN' }>);
    const target = textLimits(input as Extract<InputField, { type: 'SHORT_TEXT' | 'LONG_TEXT' | 'MARKDOWN' }>);
    if (source.min < target.min || source.max > target.max) return { status, code: 'TEXT_BOUNDS' };
    status = output.type === input.type ? 'DIRECT' : 'SAFE_TEXT_MAPPING';
    code = output.type === input.type ? 'SCALAR_SAFE' : 'TEXT_ADAPTATION';
  } else if (output.type === 'NUMBER' && input.type === 'NUMBER') {
    if ((output.constraints?.minimum ?? -Infinity) < (input.constraints?.minimum ?? -Infinity) ||
      (output.constraints?.maximum ?? Infinity) > (input.constraints?.maximum ?? Infinity)) {
      return { status, code: 'NUMBER_BOUNDS' };
    }
    status = 'DIRECT'; code = 'SCALAR_SAFE';
  } else if (output.type === input.type && ['BOOLEAN', 'URL', 'JSON'].includes(output.type)) {
    if (output.type === 'JSON' && input.type === 'JSON' && output.maxBytes > input.maxBytes) {
      return { status, code: 'JSON_BOUNDS' };
    }
    status = 'DIRECT'; code = 'SCALAR_SAFE';
  }
  if (status !== 'INCOMPATIBLE' && output.semanticType !== input.semanticType &&
    (output.semanticType || input.semanticType)) {
    return { status: 'REVIEW_REQUIRED', code: 'SEMANTIC_MISMATCH' };
  }
  return { status, code };
}

export interface ContractChange {
  readonly fieldKey: string;
  readonly surface: 'INPUT' | 'OUTPUT';
  readonly code: 'ADDED' | 'REMOVED' | 'TYPE_CHANGED' | 'REQUIRED_CHANGED' |
    'FORMAT_CHANGED' | 'CONSTRAINT_CHANGED' | 'PRESENTATION_CHANGED';
  readonly breaking: boolean;
}

/** Any change still requires a new immutable version; this only describes compatibility. */
export function classifyContractChange(rawPrevious: unknown, rawNext: unknown): {
  previous: CapabilityIOContract; next: CapabilityIOContract; changes: readonly ContractChange[];
  breaking: boolean;
} {
  const previous = CapabilityIOContractSchema.parse(rawPrevious);
  const next = CapabilityIOContractSchema.parse(rawNext);
  const changes: ContractChange[] = [];
  for (const surface of ['INPUT', 'OUTPUT'] as const) {
    const oldFields = surface === 'INPUT' ? previous.input.fields : previous.output.fields;
    const newFields = surface === 'INPUT' ? next.input.fields : next.output.fields;
    const oldByKey = new Map(oldFields.map((field) => [field.key, field]));
    const newByKey = new Map(newFields.map((field) => [field.key, field]));
    for (const [fieldKey, oldField] of oldByKey) {
      const newField = newByKey.get(fieldKey);
      if (!newField) { changes.push({ fieldKey, surface, code: 'REMOVED', breaking: true }); continue; }
      if (oldField.type !== newField.type) {
        changes.push({ fieldKey, surface, code: 'TYPE_CHANGED', breaking: true }); continue;
      }
      if (!oldField.required && newField.required) {
        changes.push({ fieldKey, surface, code: 'REQUIRED_CHANGED', breaking: true }); continue;
      }
      if ((oldField.type === 'FILE' || oldField.type === 'FILES') &&
        (newField.type === 'FILE' || newField.type === 'FILES') &&
        (hashCanonicalJson(oldField.constraints.allowedMimeTypes) !== hashCanonicalJson(newField.constraints.allowedMimeTypes) ||
        hashCanonicalJson(oldField.constraints.allowedExtensions) !== hashCanonicalJson(newField.constraints.allowedExtensions))) {
        changes.push({ fieldKey, surface, code: 'FORMAT_CHANGED', breaking: true }); continue;
      }
      if (hashCanonicalJson(oldField) !== hashCanonicalJson(newField)) {
        const oldOperational = { ...oldField, label: '', description: undefined, group: undefined, order: 0 };
        const newOperational = { ...newField, label: '', description: undefined, group: undefined, order: 0 };
        const presentationOnly = hashCanonicalJson(oldOperational) === hashCanonicalJson(newOperational);
        changes.push({ fieldKey, surface, code: presentationOnly ? 'PRESENTATION_CHANGED' : 'CONSTRAINT_CHANGED',
          breaking: !presentationOnly });
      }
    }
    for (const [fieldKey, newField] of newByKey) {
      if (oldByKey.has(fieldKey)) continue;
      const safeOptionalScalar = surface === 'INPUT' && !newField.required &&
        newField.type !== 'FILE' && newField.type !== 'FILES' && newField.type !== 'JSON' &&
        newField.type !== 'URL' && newField.type !== 'MULTI_SELECT' &&
        'defaultValue' in newField && newField.defaultValue !== undefined;
      changes.push({ fieldKey, surface, code: 'ADDED', breaking: !safeOptionalScalar });
    }
  }
  return { previous, next, changes: Object.freeze(changes), breaking: changes.some((change) => change.breaking) };
}
