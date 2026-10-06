import { PLATFORM_FILE_LIMITS } from './file-limits.js';
import { SUPPORTED_FILE_TYPES } from './file-types.js';

export type MediaPreset = 'IMAGES' | 'VIDEO' | 'AUDIO' | 'DOCUMENTS' | 'DATA' | 'THREE_D';

/** Only formats with a current safe signature/text detector are offered as presets. */
export function fileConstraintsFromPreset(preset: MediaPreset, maxFiles: number,
  maxFileSizeBytes: number): { minFiles: number; maxFiles: number; maxFileSizeBytes: number;
    maxTotalSizeBytes: number; allowedMimeTypes: string[]; allowedExtensions: string[] } {
  const formats = SUPPORTED_FILE_TYPES.filter((candidate) => candidate.preset === preset);
  if (!formats.length || !Number.isSafeInteger(maxFiles) || maxFiles < 1 ||
    maxFiles > PLATFORM_FILE_LIMITS.maxFilesPerField || !Number.isSafeInteger(maxFileSizeBytes) ||
    maxFileSizeBytes < 1 || maxFileSizeBytes > PLATFORM_FILE_LIMITS.maxSingleFileBytes) {
    throw new TypeError('Invalid media preset bounds');
  }
  return {
    minFiles: 0, maxFiles, maxFileSizeBytes,
    maxTotalSizeBytes: Math.min(maxFiles * maxFileSizeBytes, PLATFORM_FILE_LIMITS.maxTotalFieldBytes),
    allowedMimeTypes: formats.map((format) => format.mime),
    allowedExtensions: formats.flatMap((format) => [...format.extensions]),
  };
}
