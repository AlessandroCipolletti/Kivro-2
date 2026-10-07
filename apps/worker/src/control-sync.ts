import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { WORKER_PROTOCOL_VERSION, WorkerHeartbeatSchema,
  WorkerWelcomeSchema } from '../../../packages/worker-protocol/src/messages.js';
import type { WorkerInboundPollingPort } from './dispatch-loop.js';
import type { WorkerLocalState } from './local-state.js';
import type { LocalHealthReport } from './health.js';
import type { WorkerJobControl } from './job-control.js';
import { flushLocalJobControls } from './local-control-outbox.js';

/** Live, signed M12 control synchronization while the M13 job RPC composition is absent.
 * It advertises zero execution capacity, and any offer or per-job command is a protocol error.
 * The full M07 dispatch loop remains the sole execution authority. */
export class WorkerControlSync {
  constructor(private readonly transport: WorkerInboundPollingPort,
    private readonly deviceId: string, private readonly local: WorkerLocalState,
    private readonly observe: () => Promise<LocalHealthReport>,
    private readonly release: string,private readonly jobControl?:WorkerJobControl) {
    z.uuid().parse(deviceId); }

  async syncOnce(): Promise<void> {
    if(this.jobControl)await flushLocalJobControls(this.jobControl,this.transport,this.deviceId);
    const before=this.local.snapshot();
    const health=await this.observe();
    const beat=WorkerHeartbeatSchema.parse({type:'WORKER_HEARTBEAT',
      protocolVersion:WORKER_PROTOCOL_VERSION,messageId:randomUUID(),
      controlPlaneId:this.transport.controlPlaneId,workerDeviceId:this.deviceId,
      workerRelease:this.release,sentAt:new Date().toISOString(),
      openClawVersion:health.openClawVersion??null,
      openClawCompatibility:health.openClawCompatibility??'UNAVAILABLE',
      status:before.globalPaused||before.securityPaused?'PAUSED':'NOT_READY',
      runningJobs:health.runningJobs,capacity:0,policyVersion:1,
      localRevision:before.localRevision,acknowledgedCloudRevision:before.cloudRevision,
      localPause:{globalPaused:before.localPaused,securityPaused:before.securityPaused,
        capabilityPauses:before.localCapabilityPauses},
      operationalChecks:health.checks.map((check)=>({code:check.code,state:check.state})),
      capabilityReadiness:[]});
    await this.transport.send(beat);
    this.local.acknowledgeCloudRevision(before.localRevision);
    const messages=await this.transport.poll({type:'WORKER_HELLO',messageId:randomUUID(),
      workerDeviceId:this.deviceId,controlPlaneId:this.transport.controlPlaneId,
      supportedProtocolVersions:[WORKER_PROTOCOL_VERSION],workerRelease:this.release,
      localRevision:this.local.snapshot().localRevision,activeExecutionIds:[]});
    if(messages[0]?.type!=='WORKER_WELCOME')
      throw new Error('CONTROL_SYNC_UNTRUSTED_WELCOME');
    const welcome=WorkerWelcomeSchema.parse(messages[0]);
    if(welcome.controlPlaneId!==this.transport.controlPlaneId||!welcome.pauseDirective)
      throw new Error('CONTROL_SYNC_UNTRUSTED_WELCOME');
    this.local.applyCloudDirective(welcome.pauseDirective);
    this.local.recordCloudContact(0);
    if(messages.length!==1)
      throw new Error('CONTROL_ONLY_REJECTED_EXECUTION_MESSAGE');
  }

  async runUntilAborted(signal:AbortSignal,intervalMs=10_000):Promise<void>{
    if(!Number.isSafeInteger(intervalMs)||intervalMs<1_000||intervalMs>30_000)
      throw new RangeError('INVALID_SYNC_INTERVAL');
    let retryMs=intervalMs;
    try{while(!signal.aborted){
      try{await this.syncOnce();retryMs=intervalMs;}
      catch(error){
        if(error instanceof Error&&['CONTROL_ONLY_REJECTED_EXECUTION_MESSAGE',
          'CONTROL_SYNC_UNTRUSTED_WELCOME'].includes(error.message))throw error;
        retryMs=Math.min(30_000,retryMs*2);
      }
      await delay(retryMs,undefined,{signal}).catch(()=>undefined);
    }}finally{await this.transport.close();}
  }
}
