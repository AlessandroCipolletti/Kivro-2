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
}

export interface DurableTaskPort {
  signalReady(taskId: string): Promise<void>;
}

export interface WorkerSignalPort {
  signalWorker(controlPlaneId: string, workerDeviceId: string): Promise<void>;
}
