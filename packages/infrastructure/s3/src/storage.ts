import { Readable } from 'node:stream';
import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand,
  PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { z } from 'zod';
import type { ObjectStoragePort } from '../../contracts/src/ports.js';

const keySchema = z.string().regex(/^private\/assets\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/);
const hashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const contentTypeSchema = z.string().min(3).max(120).regex(/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i);
const expirySchema = z.number().int().min(30).max(900);

export interface S3StorageOptions {
  readonly bucket: string;
  readonly region: string;
  readonly endpoint?: string;
  readonly accessKeyId?: string;
  readonly secretAccessKey?: string;
  readonly allowInsecureLoopback?: boolean;
}

function checksumBase64(digest: string): string {
  return Buffer.from(hashSchema.parse(digest).slice(7), 'hex').toString('base64');
}

/** Infrastructure mechanics only. The application must authorize buyer/Worker access before calling. */
export class S3PrivateObjectStorage implements ObjectStoragePort {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(options: S3StorageOptions) {
    this.bucket = z.string().regex(/^[a-z0-9][a-z0-9.-]{2,62}$/).parse(options.bucket);
    const region = z.string().min(1).max(80).parse(options.region);
    if ((options.accessKeyId === undefined) !== (options.secretAccessKey === undefined)) {
      throw new TypeError('S3 credentials must be supplied together');
    }
    const endpoint = options.endpoint ? new URL(options.endpoint) : undefined;
    if (endpoint && (endpoint.username || endpoint.password || endpoint.search || endpoint.hash ||
      (endpoint.protocol !== 'https:' && !(options.allowInsecureLoopback && endpoint.protocol === 'http:' &&
        ['127.0.0.1', 'localhost'].includes(endpoint.hostname))))) {
      throw new TypeError('S3 endpoint must use HTTPS or approved local loopback');
    }
    this.client = new S3Client({ region, ...(endpoint ? { endpoint: endpoint.toString(), forcePathStyle: true } : {}),
      ...(options.accessKeyId && options.secretAccessKey ? { credentials: {
        accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey,
      } } : {}) });
  }

  async putPrivateObject(key: string, body: AsyncIterable<Uint8Array>, options: {
    contentType: string; sizeBytes: number; sha256: `sha256:${string}`;
  }): Promise<void> {
    keySchema.parse(key);
    contentTypeSchema.parse(options.contentType);
    z.number().int().nonnegative().parse(options.sizeBytes);
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key,
      Body: Readable.from(body), ContentLength: options.sizeBytes, ContentType: options.contentType,
      ChecksumSHA256: checksumBase64(options.sha256), Metadata: { sha256: options.sha256 },
    }));
  }

  async readPrivateObject(key: string): Promise<AsyncIterable<Uint8Array>> {
    keySchema.parse(key);
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!response.Body || !('transformToWebStream' in response.Body)) throw new Error('S3 object body unavailable');
    const stream = Readable.fromWeb(response.Body.transformToWebStream() as import('node:stream/web').ReadableStream);
    return stream;
  }

  async headPrivateObject(key: string): Promise<{ sizeBytes: number; claimedSha256: string | null } | null> {
    keySchema.parse(key);
    try {
      const response = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      if (response.ContentLength === undefined) throw new Error('S3 object length unavailable');
      const claimed = response.Metadata?.sha256 ?? null;
      return { sizeBytes: response.ContentLength, claimedSha256: claimed && hashSchema.safeParse(claimed).success ? claimed : null };
    } catch (error) {
      if (error instanceof Error && (error.name === 'NotFound' || error.name === 'NoSuchKey')) return null;
      throw error;
    }
  }

  async presignPrivateUpload(key: string, options: { contentType: string; sizeBytes: number;
    sha256: `sha256:${string}`;
    expiresSeconds: number }): Promise<{ url: string; headers: Readonly<Record<string, string>> }> {
    keySchema.parse(key);
    contentTypeSchema.parse(options.contentType);
    z.number().int().nonnegative().parse(options.sizeBytes);
    expirySchema.parse(options.expiresSeconds);
    const checksum = checksumBase64(options.sha256);
    const url = await getSignedUrl(this.client, new PutObjectCommand({ Bucket: this.bucket, Key: key,
      ContentType: options.contentType, ContentLength: options.sizeBytes,
      ChecksumSHA256: checksum, Metadata: { sha256: options.sha256 },
    }), { expiresIn: options.expiresSeconds,
      signableHeaders: new Set(['content-type', 'content-length']),
      unhoistableHeaders: new Set(['x-amz-checksum-sha256', 'x-amz-meta-sha256']),
    });
    return { url, headers: Object.freeze({ 'content-type': options.contentType,
      'x-amz-checksum-sha256': checksum, 'x-amz-meta-sha256': options.sha256 }) };
  }

  async presignPrivateDownload(key: string, expiresSeconds: number): Promise<string> {
    keySchema.parse(key);
    expirySchema.parse(expiresSeconds);
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresSeconds });
  }

  async deletePrivateObject(key: string): Promise<void> {
    keySchema.parse(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async copyPrivateObject(sourceKey: string, destinationKey: string): Promise<void> {
    keySchema.parse(sourceKey);
    keySchema.parse(destinationKey);
    if (sourceKey === destinationKey) throw new TypeError('Distinct staging and final keys required');
    await this.client.send(new CopyObjectCommand({Bucket:this.bucket,Key:destinationKey,
      CopySource:`${this.bucket}/${sourceKey}`}));
  }

  destroy(): void { this.client.destroy(); }
}
