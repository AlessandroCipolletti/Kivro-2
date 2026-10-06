import { CapabilityIOContractSchema } from '../../contracts/src/capability-io.js';
import { SUPPORTED_FILE_TYPES } from '../../contracts/src/file-types.js';

export interface FileContractIssue {
  readonly surface: 'INPUT' | 'OUTPUT';
  readonly fieldKey: string;
  readonly code: 'UNSUPPORTED_MIME' | 'UNSUPPORTED_EXTENSION' | 'MIME_EXTENSION_DISCONNECT';
  readonly value: string;
}

/** Drafts may describe future formats; publication must stop on every unresolved issue. */
export function assessFileContractReadiness(rawContract: unknown): readonly FileContractIssue[] {
  const contract = CapabilityIOContractSchema.parse(rawContract);
  const issues: FileContractIssue[] = [];
  for (const [surface, fields] of [
    ['INPUT', contract.input.fields], ['OUTPUT', contract.output.fields],
  ] as const) {
    for (const field of fields) {
      if (field.type !== 'FILE' && field.type !== 'FILES') continue;
      const mimes = field.constraints.allowedMimeTypes;
      const extensions = field.constraints.allowedExtensions.map((extension) => extension.toLowerCase());
      for (const mime of mimes) {
        const known = SUPPORTED_FILE_TYPES.find((candidate) => candidate.mime === mime);
        if (!known) issues.push({ surface, fieldKey: field.key, code: 'UNSUPPORTED_MIME', value: mime });
        else if (!known.extensions.some((extension) => extensions.includes(extension))) {
          issues.push({ surface, fieldKey: field.key, code: 'MIME_EXTENSION_DISCONNECT', value: mime });
        }
      }
      for (const extension of extensions) {
        const known = SUPPORTED_FILE_TYPES.find((candidate) =>
          candidate.extensions.some((item) => item === extension));
        if (!known) issues.push({ surface, fieldKey: field.key, code: 'UNSUPPORTED_EXTENSION', value: extension });
        else if (!mimes.includes(known.mime)) {
          issues.push({ surface, fieldKey: field.key, code: 'MIME_EXTENSION_DISCONNECT', value: extension });
        }
      }
    }
  }
  return Object.freeze(issues);
}
