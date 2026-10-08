import { z } from 'zod';
import { InputContractSchema, OutputContractSchema } from '../../contracts/src/capability-io.js';
import { validateInputPayload } from '../../contracts/src/contract-values.js';
import { JobOfferSchema, type JobOffer } from '../../worker-protocol/src/messages.js';
import { workerExecutionEventId } from '../../worker-protocol/src/event-id.js';
import type { AcceptedWorkerInput } from '../../persistence/src/job-execution.js';
import type {WorkerRpcTransport} from '../../worker-protocol/src/transport.js';
import type {ResearchBinding,NormalizedSearchResult,WebPageResult,DownloadResult} from
  './research-broker.js';
import { createHash, randomUUID } from 'node:crypto';

export class WorkerCloudProtocolError extends Error {
  constructor(readonly code:'WRONG_CONTROL_PLANE'|'PROTOCOL_MISMATCH'){
    super(code);this.name='WorkerCloudProtocolError';
  }
}

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

/** Shared Worker job service. Network adapters only carry signed protocol frames. */
export class ProtocolWorkerJobCloud {
  constructor(private readonly transport: WorkerRpcTransport) {}

  private binding(raw: unknown): Pick<JobOffer, 'jobId' | 'executionId' | 'attemptId' |
    'workerDeviceId' | 'controlPlaneId' | 'leaseToken'> {
    const offer = JobOfferSchema.parse(raw);
    if (offer.controlPlaneId !== this.transport.controlPlaneId) {
      throw new WorkerCloudProtocolError('WRONG_CONTROL_PLANE');
    }
    return { jobId: offer.jobId, executionId: offer.executionId, attemptId: offer.attemptId,
      workerDeviceId: offer.workerDeviceId, controlPlaneId: offer.controlPlaneId,
      leaseToken: offer.leaseToken };
  }

  /** The Worker never receives the platform search credential or chooses its
   * financial/policy binding; the cloud revalidates those on each RPC. */
  researchFor(offer:JobOffer):{
    search(binding:ResearchBinding,input:{query:string;maxResults:number;
      locale?:string;requestId?:string}):Promise<readonly NormalizedSearchResult[]>;
    fetch(binding:ResearchBinding,input:{url:string;method?:string;
      requestId?:string}):Promise<WebPageResult>;
    download(binding:ResearchBinding,input:{url:string;
      requestId?:string}):Promise<DownloadResult>;
  }{
    const bound=this.binding(offer);
    const check=(candidate:ResearchBinding)=>{
      if(candidate.jobId!==bound.jobId||
        candidate.capabilityVersionId!==offer.capabilityVersionId)
        throw new WorkerCloudProtocolError('PROTOCOL_MISMATCH');
    };
    return {
      search:async(candidate,input)=>{
        check(candidate);
        const data=z.strictObject({results:z.array(z.strictObject({
          url:z.url(),title:z.string(),description:z.string(),
          trust:z.literal('UNTRUSTED_PUBLIC_WEB')})).max(20)}).parse(
          await this.transport.postJobRpc('RESEARCH_SEARCH',{...bound,
            research:{requestId:input.requestId??randomUUID(),query:input.query,
              maxResults:input.maxResults}}));
        return data.results;
      },
      fetch:async(candidate,input)=>{
        check(candidate);
        if(input.method&&input.method!=='GET')
          throw new WorkerCloudProtocolError('PROTOCOL_MISMATCH');
        const page=z.strictObject({finalUrl:z.url(),title:z.string().optional(),
          text:z.string().max(1_000_000),contentType:z.string(),
          fetchedAt:z.iso.datetime(),trust:z.literal('UNTRUSTED_PUBLIC_WEB')}).parse(
          await this.transport.postJobRpc('RESEARCH_FETCH',{...bound,
            research:{requestId:input.requestId??randomUUID(),url:input.url}}));
        const {title,...pageWithoutTitle}=page;
        return title===undefined?pageWithoutTitle:{...pageWithoutTitle,title};
      },
      download:async(candidate,input)=>{
        check(candidate);
        const data=z.strictObject({finalUrl:z.url(),name:z.string(),contentType:z.string(),
          sha256:digest,trust:z.literal('UNTRUSTED_DOWNLOAD_DATA'),
          bytesBase64:z.string().max(1_400_000)}).parse(
          await this.transport.postJobRpc('RESEARCH_DOWNLOAD',{...bound,
            research:{requestId:input.requestId??randomUUID(),url:input.url}}));
        const bytes=Buffer.from(data.bytesBase64,'base64');
        if(bytes.byteLength>1_000_000||
          `sha256:${createHash('sha256').update(bytes).digest('hex')}`!==data.sha256)
          throw new WorkerCloudProtocolError('PROTOCOL_MISMATCH');
        const {bytesBase64:_,...rest}=data;void _;
        return {...rest,sha256:rest.sha256 as `sha256:${string}`,bytes};
      }
    };
  }

  async markPrivateResourceRead(offer:JobOffer):Promise<void>{
    ok.parse(await this.transport.postJobRpc('PRIVATE_RESOURCE_READ',{
      ...this.binding(offer),read:{requestId:randomUUID()}}));
  }

  async accept(offer: JobOffer, messageId: string): Promise<void> {
    ok.parse(await this.transport.postJobRpc('ACCEPT', { ...this.binding(offer), messageId: uuid.parse(messageId) }));
  }

  async acceptedInput(offer: JobOffer): Promise<AcceptedWorkerInput> {
    const binding = this.binding(offer);
    const raw = acceptedInputSchema.parse(await this.transport.postJobRpc('ACCEPTED_INPUT', binding));
    if (raw.jobId !== binding.jobId || raw.executionId !== binding.executionId ||
      raw.attemptId !== binding.attemptId) throw new WorkerCloudProtocolError('PROTOCOL_MISMATCH');
    return { ...raw, payload: validateInputPayload(raw.inputContract, raw.payload) };
  }

  async transition(offer: JobOffer, input: unknown): Promise<void> {
    const binding = this.binding(offer);
    const event = transitionSchema.parse(input);
    if (event.jobId !== binding.jobId || event.attemptId !== binding.attemptId ||
      event.correlationId !== binding.executionId) throw new WorkerCloudProtocolError('PROTOCOL_MISMATCH');
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
      throw new WorkerCloudProtocolError('PROTOCOL_MISMATCH');
    return result;
  }

  async finalizeResult(raw: unknown): Promise<void> {
    const result = z.strictObject({ resultManifestId: uuid, jobId: uuid, executionId: uuid,
      attemptId: uuid, workerDeviceId: uuid, controlPlaneId: z.string().min(1),
      leaseToken: z.string().min(32), retainUntil: z.iso.datetime({ offset: true }),
      payload: z.unknown(), assets: z.array(z.unknown()).max(50) }).parse(raw);
    if (result.controlPlaneId !== this.transport.controlPlaneId) {
      throw new WorkerCloudProtocolError('WRONG_CONTROL_PLANE');
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
