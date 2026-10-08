import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { z } from 'zod';
import { DockerJobControlAdapter } from '../../../packages/sandbox-adapter/src/docker.js';

const requestSchema = z.strictObject({
  type: z.literal('REQUEST'), id: z.uuid(),
  kind: z.enum(['INFERENCE', 'RESEARCH_SEARCH', 'RESEARCH_FETCH', 'RESEARCH_DOWNLOAD',
    'RESOURCE_READ', 'DECLARED_API', 'SELECTED_FILE_READ']),
  payload: z.unknown(),
});
export type BrokerRequest = z.infer<typeof requestSchema>;

export class BrokerSidecarError extends Error {
  constructor(readonly code: 'NOT_READY' | 'PROTOCOL' | 'DENIED' | 'STOPPED') {
    super(code); this.name = 'BrokerSidecarError';
  }
}

/** The only sandbox-to-Worker channel is a fixed Docker exec stdio stream. */
export class BrokerSidecar {
  private child: ChildProcessWithoutNullStreams | undefined;
  private readonly active = new Set<Promise<void>>();
  private readonly aborts = new Set<AbortController>();
  private ready = false;
  private stopped = false;
  private containerId: string | undefined;

  constructor(private readonly dockerExecutable: string, private readonly docker: DockerJobControlAdapter,
    private readonly jobId: string, private readonly attemptId: string,
    private readonly authorize: () => Promise<void>,
    private readonly dispatch: (request: BrokerRequest, signal: AbortSignal) => Promise<unknown>,
    private readonly activity?: { begin(requestId: string): void; end(requestId: string): void },
    private readonly pauseLifecycle?: { deferNewRequest(): boolean;
      authorizeInFlightCompletion(): Promise<void> }) {
    if (!dockerExecutable.startsWith('/')) throw new TypeError('Docker path must be absolute');
    z.uuid().parse(jobId); z.uuid().parse(attemptId);
  }

  async start(containerId: string): Promise<void> {
    if (this.child) {
      if (this.containerId !== containerId || !this.ready) throw new BrokerSidecarError('PROTOCOL');
      return;
    }
    if (await this.docker.status(containerId, this.jobId, this.attemptId) !== 'running') {
      throw new BrokerSidecarError('NOT_READY');
    }
    await this.authorize();
    this.containerId = containerId;
    const child = spawn(this.dockerExecutable, ['exec', '-i', '--user=65532:65532',
      containerId, 'node', '/opt/kivro/bridge.mjs'], { stdio: ['pipe', 'pipe', 'pipe'] });
    this.child = child;
    let buffer = '';
    let resolveReady: (() => void) | undefined;
    let rejectReady: ((error: Error) => void) | undefined;
    const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    const timeout = setTimeout(() => {
      rejectReady?.(new BrokerSidecarError('NOT_READY'));
      child.kill('SIGKILL');
    }, 10_000);
    const fail = (): void => {
      this.stopped = true; this.ready = false;
      for (const controller of this.aborts) controller.abort();
      rejectReady?.(new BrokerSidecarError('STOPPED'));
    };
    child.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      if (Buffer.byteLength(buffer) > 1_048_576) { fail(); child.kill('SIGKILL'); return; }
      let end: number;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
        try {
          const message = JSON.parse(line) as unknown;
          if (!this.ready) {
            if (!message || typeof message !== 'object' ||
              (message as { type?: unknown }).type !== 'READY' ||
              (message as { protocolVersion?: unknown }).protocolVersion !== 1) throw new Error('PROTOCOL');
            this.ready = true; resolveReady?.(); continue;
          }
          const request = requestSchema.parse(message);
          if (this.active.size >= 16) throw new Error('PROTOCOL');
          const operation = this.handle(request);
          this.active.add(operation);
          void operation.then(() => this.active.delete(operation), () => {
            this.active.delete(operation); fail(); child.kill('SIGKILL');
          });
        } catch { fail(); child.kill('SIGKILL'); return; }
      }
    });
    let stderrBytes = 0;
    child.stderr.on('data', (chunk: Buffer) => {
      // stderr is deliberately not forwarded: it may contain buyer data or credentials.
      stderrBytes += chunk.byteLength;
      if (stderrBytes > 1_048_576) { fail(); child.kill('SIGKILL'); }
    });
    child.on('error', fail);
    child.on('close', fail);
    child.stdin.on('error', fail);
    try { await ready; }
    finally { clearTimeout(timeout); }
  }

  private async handle(request: BrokerRequest): Promise<void> {
    const controller = new AbortController();
    this.aborts.add(controller);
    let response: unknown;
    let admitted = false;
    try {
      // A request arriving after PAUSE_REQUESTED waits without opening a host
      // broker operation. Docker may then freeze safely; resume admits it.
      for (;;) {
        for (;;) {
          while (this.pauseLifecycle?.deferNewRequest()) {
            if (controller.signal.aborted || this.stopped) throw new BrokerSidecarError('DENIED');
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
          if (controller.signal.aborted || this.stopped) throw new BrokerSidecarError('DENIED');
          try {
            await this.authorize();
            this.activity?.begin(request.id);
            admitted = true;
            break;
          } catch (error) {
            if (!this.pauseLifecycle?.deferNewRequest()) throw error;
          }
        }
        try { response = await this.dispatch(request, controller.signal); break; }
        catch (error) {
          if (!this.pauseLifecycle || !(error instanceof Error && 'code' in error &&
            error.code === 'PAUSE_PENDING')) throw error;
          // Cloud can request pause before the command reaches this Worker.
          // A rejected broker RPC has had no effect. Release the local activity
          // barrier, then retry the same request only after Core permits it.
          this.activity?.end(request.id);
          admitted = false;
          if (controller.signal.aborted || this.stopped) throw new BrokerSidecarError('DENIED');
          await new Promise((resolve) => setTimeout(resolve, 1_000));
        }
      }
      if (this.pauseLifecycle) await this.pauseLifecycle.authorizeInFlightCompletion();
      else await this.authorize();
      if (controller.signal.aborted) throw new BrokerSidecarError('DENIED');
      const encoded = JSON.stringify({ id: request.id, ok: true, result: response });
      if (Buffer.byteLength(encoded) > 2_097_152) throw new BrokerSidecarError('DENIED');
      if (!this.stopped && this.child?.stdin.writable) this.child.stdin.write(`${encoded}\n`);
    } catch (error) {
      if (!this.stopped && this.child?.stdin.writable) {
        const code = error && typeof error === 'object' && 'code' in error &&
          error.code === 'SOURCE_UNAVAILABLE' ? 'SOURCE_UNAVAILABLE' : 'BROKER_DENIED';
        this.child.stdin.write(`${JSON.stringify({ id: request.id, ok: false, code })}\n`);
      }
    } finally {
      if (admitted) {
        try { this.activity?.end(request.id); }
        catch { this.stopped = true; this.child?.kill('SIGKILL'); }
      }
      this.aborts.delete(controller);
    }
  }

  /** Abort host operations before Docker can claim the job is paused. */
  async quiesce(): Promise<void> {
    for (const controller of this.aborts) controller.abort();
    if (this.active.size === 0) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([Promise.allSettled([...this.active]), new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new BrokerSidecarError('DENIED')), 10_000);
      })]);
    } finally { if (timer) clearTimeout(timer); }
    if (this.active.size) throw new BrokerSidecarError('DENIED');
  }

  async close(): Promise<void> {
    if (!this.child) return;
    await this.quiesce();
    this.child.stdin.end();
    this.child.kill('SIGTERM');
    this.stopped = true;
    this.ready = false;
  }

  get healthy(): boolean { return this.ready && !this.stopped; }
}
