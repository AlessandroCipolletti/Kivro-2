import { z } from 'zod';
import { InputContractSchema, OutputContractSchema } from '../../../contracts/src/capability-io.js';
import { validateInputPayload } from '../../../contracts/src/contract-values.js';
import { JobOfferSchema, type JobOffer } from '../../../worker-protocol/src/messages.js';
import { workerExecutionEventId } from '../../../worker-protocol/src/event-id.js';
import type { AcceptedWorkerInput } from '../../../persistence/src/job-execution.js';
import { HttpsPollingWorkerTransport, WorkerPollingError } from './https-polling.js';

const uuid = z.uuid();
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const acceptedInputSchema = z.strictObject({
  jobId: uuid, executionId: uuid, attemptId: uuid, buyerAccountId: uuid,
  outputRetainUntil: z.iso.datetime({ offset: true }), inputManifestId: uuid,
  inputManifestHash: digest, inputSchemaHash: digest,
  inputContract: InputContractSchema, outputContract: OutputContractSchema,
  payload: z.unknown(),
  stagedAssets: z.record(z.string(), z.array(z.strictObject({ assetId: uuid,
    extension: z.string().regex(/^\.[a-z0-9]{1,16}$/),
    detectedMimeType: z.string().min(3).max(120), sizeBytes: z.number().int().nonnegative() })).max(50)),
  downloads: z.array(z.strictObject({ binding: z.strictObject({ fieldKey: z.string(),
    assetId: uuid, path: z.string(), detectedMimeType: z.string(),
    sizeBytes: z.number().int().nonnegative() }), signedGetUrl: z.url(),
    expectedSha256: digest })).max(50),
});
const transitionSchema = z.strictObject({
  id: uuid, jobId: uuid, from: z.enum(['ACCEPTED', 'STARTING', 'RUNNING']),
  to: z.enum(['STARTING', 'RUNNING', 'UPLOADING_RESULT']), actor: z.literal('WORKER'),
  reason: z.string().min(1).max(200), attemptId: uuid, correlationId: uuid,
  paymentReservationId: z.null(), resultManifestId: z.null(),
});
const ok = z.strictObject({ ok: z.literal(true) });
const finalDisposition=z.union([ok,z.strictObject({ok:z.literal(false),
  code:z.literal('RESULT_REJECTED')})]);
const preparedAsset=z.strictObject({assetId:uuid,
  objectKey:z.string().regex(/^private\/assets\/[a-f0-9-]{36}\/[a-f0-9-]{36}$/),
  uploadUrl:z.url(),uploadHeaders:z.record(z.string(),z.string())});

/** Netsons HTTPS implementation of the provider-neutral Worker job service port. */
export class NetsonsWorkerJobCloud {
  constructor(private readonly transport: HttpsPollingWorkerTransport) {}

  private binding(raw: unknown): Pick<JobOffer, 'jobId' | 'executionId' | 'attemptId' |
    'workerDeviceId' | 'controlPlaneId' | 'leaseToken'> {
    const offer = JobOfferSchema.parse(raw);
    if (offer.controlPlaneId !== this.transport.controlPlaneId) {
      throw new WorkerPollingError('WRONG_CONTROL_PLANE');
    }
    return { jobId: offer.jobId, executionId: offer.executionId, attemptId: offer.attemptId,
      workerDeviceId: offer.workerDeviceId, controlPlaneId: offer.controlPlaneId,
      leaseToken: offer.leaseToken };
  }

  async accept(offer: JobOffer, messageId: string): Promise<void> {
    ok.parse(await this.transport.postJobRpc('ACCEPT', { ...this.binding(offer), messageId: uuid.parse(messageId) }));
  }

  async acceptedInput(offer: JobOffer): Promise<AcceptedWorkerInput> {
    const binding = this.binding(offer);
    const raw = acceptedInputSchema.parse(await this.transport.postJobRpc('ACCEPTED_INPUT', binding));
    if (raw.jobId !== binding.jobId || raw.executionId !== binding.executionId ||
      raw.attemptId !== binding.attemptId) throw new WorkerPollingError('PROTOCOL_MISMATCH');
    return { ...raw, payload: validateInputPayload(raw.inputContract, raw.payload) };
  }

  async transition(offer: JobOffer, input: unknown): Promise<void> {
    const binding = this.binding(offer);
    const event = transitionSchema.parse(input);
    if (event.jobId !== binding.jobId || event.attemptId !== binding.attemptId ||
      event.correlationId !== binding.executionId) throw new WorkerPollingError('PROTOCOL_MISMATCH');
    ok.parse(await this.transport.postJobRpc('TRANSITION', { ...binding, event }));
  }

  async renewLease(offer: JobOffer, ttlSeconds: number): Promise<string> {
    const value = z.number().int().min(5).max(3600).parse(ttlSeconds);
    const result = z.strictObject({ leaseExpiresAt: z.iso.datetime() }).parse(
      await this.transport.postJobRpc('RENEW_LEASE', { ...this.binding(offer), ttlSeconds: value }));
    return result.leaseExpiresAt;
  }

  async prepareResultAsset(offer:JobOffer,asset:{assetId:string;fieldKey:string;
    extension:string;sizeBytes:number;sha256:string;detectedMimeType:string}){
    const binding=this.binding(offer);
    const result=preparedAsset.parse(await this.transport.postJobRpc('PREPARE_RESULT_ASSET',
      {...binding,...asset}));
    if(result.assetId!==asset.assetId||
      result.objectKey.split('/')[2]!==asset.assetId)
      throw new WorkerPollingError('PROTOCOL_MISMATCH');
    return result;
  }

  async finalizeResult(raw: unknown): Promise<void> {
    const result = z.strictObject({ resultManifestId: uuid, jobId: uuid, executionId: uuid,
      attemptId: uuid, workerDeviceId: uuid, controlPlaneId: z.string().min(1),
      leaseToken: z.string().min(32), retainUntil: z.iso.datetime({ offset: true }),
      payload: z.unknown(), assets: z.array(z.unknown()).max(50) }).parse(raw);
    if (result.controlPlaneId !== this.transport.controlPlaneId) {
      throw new WorkerPollingError('WRONG_CONTROL_PLANE');
    }
    // A cloud safety rejection is a terminal acknowledgement. Retrying the
    // same unsafe file can never make it deliverable or restore payment.
    finalDisposition.parse(await this.transport.postJobRpc('FINALIZE_RESULT', result));
  }

  async failExecution(offer: JobOffer, input: { from: 'ACCEPTED' | 'STARTING' | 'RUNNING' |
    'UPLOADING_RESULT'; to: 'FAILED_POLICY' | 'FAILED_STARTUP' | 'FAILED_EXECUTION' |
    'RESULT_REJECTED';
    reason: string }): Promise<void> {
    const binding = this.binding(offer);
    const failure = z.strictObject({ from: z.enum(['ACCEPTED', 'STARTING', 'RUNNING', 'UPLOADING_RESULT']),
      to: z.enum(['FAILED_POLICY', 'FAILED_STARTUP', 'FAILED_EXECUTION', 'RESULT_REJECTED']),
      reason: z.string().regex(/^[A-Z][A-Z0-9_]{0,79}$/) }).parse(input);
    ok.parse(await this.transport.postJobRpc('TRANSITION', { ...binding, event: {
      id: workerExecutionEventId(offer.executionId, failure.to), jobId: offer.jobId,
      from: failure.from, to: failure.to, actor: 'WORKER', reason: failure.reason,
      attemptId: offer.attemptId, correlationId: offer.executionId,
      paymentReservationId: null, resultManifestId: null,
    } }));
  }
}
