/** Infrastructure ports carry mechanics. Shared application services own their semantics. */
export interface ObjectStoragePort {
  putPrivateObject(key: string, body: AsyncIterable<Uint8Array>, options: {
    contentType: string; sizeBytes: number; sha256: `sha256:${string}`;
  }): Promise<void>;
  readPrivateObject(key: string): Promise<AsyncIterable<Uint8Array>>;
  headPrivateObject(key: string): Promise<{ sizeBytes: number; claimedSha256: string | null } | null>;
  presignPrivateUpload(key: string, options: { contentType: string; sizeBytes: number;
    sha256: `sha256:${string}`;
    expiresSeconds: number }): Promise<{ url: string; headers: Readonly<Record<string, string>> }>;
  presignPrivateDownload(key: string, expiresSeconds: number): Promise<string>;
  deletePrivateObject(key: string): Promise<void>;
  copyPrivateObject(sourceKey: string, destinationKey: string): Promise<void>;
}

export interface DurableTaskPort {
  signalReady(taskId: string): Promise<void>;
}

export interface WorkerSignalPort {
  signalWorker(controlPlaneId: string, workerDeviceId: string): Promise<void>;
}

/** A webhook socket is created only to the already-vetted address, with the URL host
 * retained for TLS name verification. Implementations must never follow redirects. */
export interface PinnedWebhookPostPort {
  post(input:{url:URL;pinnedAddress:string;body:Uint8Array;
    headers:Readonly<Record<string,string>>;timeoutMs:number;maxResponseBytes:number}):
    Promise<{status:number}>;
}
