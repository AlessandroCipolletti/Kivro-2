/** One host-wide admission guard shared by all control-plane transports.
 * Database ownership and cloud leases remain authoritative; this prevents two
 * concurrent local polling loops from oversubscribing the same Docker host. */
export class WorkerDispatchCapacity {
  private readonly inFlight=new Map<string,{planeId:string;versionId:string}>();

  constructor(readonly limit:number){
    if(!Number.isSafeInteger(limit)||limit<1||limit>64)
      throw new RangeError('Invalid Worker execution capacity');
  }

  activeCount(snapshots:readonly {executionId:string;status:string}[]):number{
    const ids=new Set(this.inFlight.keys());
    for(const snapshot of snapshots){
      if(!['STOPPED','CANCELLED','TIMED_OUT'].includes(snapshot.status))
        ids.add(snapshot.executionId);
    }
    return ids.size;
  }

  inFlightForPlane(controlPlaneId:string):number{
    return [...this.inFlight.values()].filter((item)=>item.planeId===controlPlaneId).length;
  }

  reserve(input:{executionId:string;controlPlaneId:string;capabilityVersionId:string},
    capabilityLimit:number,snapshots:readonly {executionId:string;
      capabilityVersionId:string;status:string;controlPlaneId:string}[]):
    'ACQUIRED'|'DUPLICATE'|'WRONG_CONTROL_PLANE'|'CAPACITY_FULL'{
    const prior=this.inFlight.get(input.executionId);
    if(prior)return prior.planeId===input.controlPlaneId?'DUPLICATE':'WRONG_CONTROL_PLANE';
    const persisted=snapshots.find((item)=>item.executionId===input.executionId);
    if(persisted)return persisted.controlPlaneId===input.controlPlaneId?
      'DUPLICATE':'WRONG_CONTROL_PLANE';
    const total=this.activeCount(snapshots);
    const versions=new Set([...this.inFlight].filter(([,item])=>
      item.versionId===input.capabilityVersionId).map(([executionId])=>executionId));
    for(const snapshot of snapshots)if(snapshot.capabilityVersionId===input.capabilityVersionId&&
      !['STOPPED','CANCELLED','TIMED_OUT'].includes(snapshot.status))
      versions.add(snapshot.executionId);
    if(total>=this.limit||versions.size>=capabilityLimit)return 'CAPACITY_FULL';
    this.inFlight.set(input.executionId,{planeId:input.controlPlaneId,
      versionId:input.capabilityVersionId});
    return 'ACQUIRED';
  }

  release(executionId:string,controlPlaneId:string):void{
    if(this.inFlight.get(executionId)?.planeId===controlPlaneId)
      this.inFlight.delete(executionId);
  }
}
