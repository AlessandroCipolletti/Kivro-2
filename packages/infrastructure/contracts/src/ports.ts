/** Infrastructure ports carry mechanics. Shared application services own their semantics. */
export interface ObjectStoragePort {
  putPrivateObject(key: string, body: AsyncIterable<Uint8Array>, contentType: string): Promise<void>;
  headPrivateObject(key: string): Promise<{ sizeBytes: number; sha256: string } | null>;
  deletePrivateObject(key: string): Promise<void>;
}

export interface DurableTaskPort {
  signalReady(taskId: string): Promise<void>;
}

export interface WorkerSignalPort {
  signalWorker(controlPlaneId: string, workerDeviceId: string): Promise<void>;
}
