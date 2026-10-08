import { extname } from 'node:path';

/** Signature-backed formats currently supported by the file boundary. */
export const SUPPORTED_FILE_TYPES = Object.freeze([
  { mime: 'image/jpeg', extensions: ['.jpg', '.jpeg'], preset: 'IMAGES' },
  { mime: 'image/png', extensions: ['.png'], preset: 'IMAGES' },
  { mime: 'image/webp', extensions: ['.webp'], preset: 'IMAGES' },
  { mime: 'image/gif', extensions: ['.gif'], preset: 'IMAGES' },
  { mime: 'video/mp4', extensions: ['.mp4'], preset: 'VIDEO' },
  { mime: 'video/quicktime', extensions: ['.mov'], preset: 'VIDEO' },
  { mime: 'video/webm', extensions: ['.webm'], preset: 'VIDEO' },
  { mime: 'audio/mpeg', extensions: ['.mp3'], preset: 'AUDIO' },
  { mime: 'audio/mp4', extensions: ['.m4a'], preset: 'AUDIO' },
  { mime: 'audio/wav', extensions: ['.wav'], preset: 'AUDIO' },
  { mime: 'audio/flac', extensions: ['.flac'], preset: 'AUDIO' },
  { mime: 'application/pdf', extensions: ['.pdf'], preset: 'DOCUMENTS' },
  { mime: 'text/plain', extensions: ['.txt'], preset: 'DOCUMENTS' },
  { mime: 'text/markdown', extensions: ['.md'], preset: 'DOCUMENTS' },
  { mime: 'text/csv', extensions: ['.csv'], preset: 'DATA' },
  { mime: 'application/json', extensions: ['.json'], preset: 'DATA' },
  { mime: 'application/x-blender', extensions: ['.blend'], preset: 'THREE_D' },
  { mime: 'model/gltf-binary', extensions: ['.glb'], preset: 'THREE_D' },
  { mime: 'model/obj', extensions: ['.obj'], preset: 'THREE_D' },
] as const);

export type SupportedFileMime = (typeof SUPPORTED_FILE_TYPES)[number]['mime'];

/** A stored result has an opaque object key; derive a safe download extension
 * from the independently validated MIME rather than a Worker-supplied name. */
export function safeResultFileName(assetId:string,mime:string):string{
  if(!/^[a-f0-9-]{36}$/.test(assetId))throw new TypeError('Invalid asset ID');
  const format=SUPPORTED_FILE_TYPES.find((candidate)=>candidate.mime===mime);
  if(!format)throw new TypeError('Unsupported result MIME');
  return `kivro-result-${assetId}${format.extensions[0]}`;
}

/** Public examples use contract field names; neither storage IDs nor seller host paths become filenames. */
export function safeExampleFileName(fieldKey:string,mime:string):string{
  if(!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(fieldKey))throw new TypeError('Invalid example field');
  const format=SUPPORTED_FILE_TYPES.find((candidate)=>candidate.mime===mime);
  if(!format)throw new TypeError('Unsupported example MIME');
  return `kivro-example-${fieldKey.toLowerCase()}${format.extensions[0]}`;
}

function isWebmHeader(bytes: Buffer): boolean {
  if (!bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return false;
  for (let offset = 4; offset + 7 <= bytes.length; offset += 1) {
    if (bytes[offset] !== 0x42 || bytes[offset + 1] !== 0x82) continue;
    if (bytes[offset + 2] !== 0x84) continue;
    if (bytes.subarray(offset + 3, offset + 7).toString('ascii') === 'webm') return true;
  }
  return false;
}

function isMp3Header(bytes: Buffer): boolean {
  if (bytes.length >= 10 && bytes.subarray(0, 3).toString('ascii') === 'ID3' &&
    bytes[3]! >= 2 && bytes[3]! <= 4 && bytes[4] === 0 &&
    [...bytes.subarray(6, 10)].every((byte) => byte < 0x80)) return true;
  if (bytes.length < 4) return false;
  const header = bytes.readUInt32BE(0);
  return ((header >>> 21) & 0x7ff) === 0x7ff &&
    ((header >>> 19) & 0x3) !== 1 && // reserved MPEG version
    ((header >>> 17) & 0x3) !== 0 && // reserved layer
    ((header >>> 12) & 0xf) !== 0xf && ((header >>> 12) & 0xf) !== 0 &&
    ((header >>> 10) & 0x3) !== 3; // reserved sampling rate
}

/** The caller must validate the entire text stream after this header check. */
export function detectFileMime(header: Uint8Array, fileName: string): SupportedFileMime | null {
  const bytes = Buffer.from(header);
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.subarray(0, 6).toString('ascii') === 'GIF87a' || bytes.subarray(0, 6).toString('ascii') === 'GIF89a') return 'image/gif';
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (bytes.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  if (bytes.subarray(0, 7).toString('ascii') === 'BLENDER') return 'application/x-blender';
  if (bytes.subarray(0, 4).toString('ascii') === 'glTF') return 'model/gltf-binary';
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WAVE') return 'audio/wav';
  if (bytes.subarray(0, 4).toString('ascii') === 'fLaC') return 'audio/flac';
  if (isWebmHeader(bytes)) return 'video/webm';
  if (isMp3Header(bytes)) return 'audio/mpeg';
  if (bytes.length >= 12 && bytes.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = bytes.subarray(8, 12).toString('ascii');
    if (brand === 'qt  ') return 'video/quicktime';
    if (brand === 'M4A ' || brand === 'M4B ') return 'audio/mp4';
    if (['isom', 'iso2', 'avc1', 'mp41', 'mp42', 'M4V '].includes(brand)) return 'video/mp4';
    return null;
  }
  const extension = extname(fileName).toLowerCase();
  if (!['.txt', '.md', '.csv', '.json', '.obj'].includes(extension) || bytes.includes(0)) return null;
  try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { return null; }
  return ({ '.txt': 'text/plain', '.md': 'text/markdown', '.csv': 'text/csv',
    '.json': 'application/json', '.obj': 'model/obj' } as const)[extension as '.txt' | '.md' | '.csv' | '.json' | '.obj'];
}

/** MIME and extension must describe the same format, not just be separately allowlisted. */
export function isMatchingFileType(fileName: string, detectedMime: string,
  allowedMimeTypes: readonly string[], allowedExtensions: readonly string[]): boolean {
  const extension = extname(fileName).toLowerCase();
  const format = SUPPORTED_FILE_TYPES.find((candidate) => candidate.mime === detectedMime);
  return !!format && format.extensions.some((candidate) => candidate === extension) &&
    allowedMimeTypes.includes(detectedMime) &&
    allowedExtensions.some((candidate) => candidate.toLowerCase() === extension);
}
