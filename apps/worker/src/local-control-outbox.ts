import { randomUUID } from 'node:crypto';
import { WorkerLocalJobControlReportSchema, WORKER_PROTOCOL_VERSION } from
  '../../../packages/worker-protocol/src/messages.js';
import type { WorkerInboundPollingPort } from './dispatch-loop.js';
import type { WorkerJobControl } from './job-control.js';

/** Replays only locally confirmed control actions. Cloud returns 204 after a
 * durable APPLIED/STALE decision; a lost acknowledgement causes safe replay. */
export async function flushLocalJobControls(control:WorkerJobControl,
  transport:WorkerInboundPollingPort,deviceId:string):Promise<number>{
  let delivered=0;
  for(const snapshot of control.snapshots()){
    if(!snapshot.cloudSyncPending||snapshot.controlPlaneId!==transport.controlPlaneId)continue;
    const pending=control.commandHistory(snapshot.jobId).filter((entry)=>
      entry.source!=='WEB'&&entry.confirmed_at!==null&&
      Number(entry.local_revision)>snapshot.acknowledgedRevision);
    for(const entry of pending){
      const report=WorkerLocalJobControlReportSchema.parse({
        type:'LOCAL_JOB_CONTROL_REPORT',protocolVersion:WORKER_PROTOCOL_VERSION,
        messageId:randomUUID(),commandId:entry.id,jobId:snapshot.jobId,
        executionId:snapshot.executionId,attemptId:snapshot.attemptId,
        controlPlaneId:snapshot.controlPlaneId,workerDeviceId:deviceId,
        action:entry.action,source:entry.source,actorId:entry.actor_id,
        reason:entry.reason,status:entry.resulting_state,
        localRevision:entry.local_revision,confirmedAt:entry.confirmed_at});
      await transport.send(report);
      control.acknowledge(snapshot.jobId,snapshot.executionId,
        snapshot.controlPlaneId,Number(entry.local_revision));
      delivered++;
    }
  }
  return delivered;
}
