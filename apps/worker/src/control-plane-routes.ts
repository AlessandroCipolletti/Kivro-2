import {WorkerDiscoveryDocumentSchema,WorkerDiscoveryPlaneSchema} from
  '../../../packages/worker-protocol/src/discovery.js';
import {openPrivateWorkerSqlite} from './local-state.js';

type Plane=ReturnType<typeof WorkerDiscoveryPlaneSchema.parse>;

/** Only discovery-validated routes are cached. A restart can reconcile an
 * execution with its former plane even after discovery promotes a new one.
 * Cached routes are always draining: they can never authorize new offers. */
export class WorkerControlPlaneRoutes {
  private readonly db;
  constructor(stateDir:string){
    this.db=openPrivateWorkerSqlite(stateDir,'control-plane-routes.sqlite');
    this.db.exec(`CREATE TABLE IF NOT EXISTS worker_control_plane_routes(
      control_plane_id TEXT PRIMARY KEY, discovery_json TEXT NOT NULL,
      observed_at TEXT NOT NULL)`);
  }
  remember(raw:unknown):void{
    const plane=WorkerDiscoveryPlaneSchema.parse(raw);
    this.db.prepare(`INSERT INTO worker_control_plane_routes(control_plane_id,
      discovery_json,observed_at) VALUES(?,?,?) ON CONFLICT(control_plane_id)
      DO UPDATE SET discovery_json=excluded.discovery_json,
      observed_at=excluded.observed_at`).run(plane.id,JSON.stringify(plane),
        new Date().toISOString());
  }
  draining(controlPlaneId:string):Plane|null{
    const row=this.db.prepare(`SELECT discovery_json FROM worker_control_plane_routes
      WHERE control_plane_id=?`).get(controlPlaneId) as
      {discovery_json:string}|undefined;
    if(!row)return null;
    try{return {...WorkerDiscoveryPlaneSchema.parse(JSON.parse(row.discovery_json) as unknown),
      state:'DRAINING'};}
    catch{return null;}
  }
  forget(controlPlaneId:string):void{
    this.db.prepare('DELETE FROM worker_control_plane_routes WHERE control_plane_id=?')
      .run(controlPlaneId);
  }
  close():void{this.db.close();}
}

/** Discovery authorizes exactly one ACTIVE plane. A route remembered from an
 * earlier trusted discovery may only finish work already owned by that plane. */
export function restoreOwnedControlPlaneRoutes(current:readonly Plane[],
  ownedIds:ReadonlySet<string>,cache:WorkerControlPlaneRoutes):readonly Plane[]{
  const result=[...current];
  for(const id of ownedIds){
    if(result.some((plane)=>plane.id===id))continue;
    const cached=cache.draining(id);
    if(!cached||result.length>=2)throw new Error('WORKER_OWNED_PLANE_ROUTE_MISSING');
    result.push(cached);
  }
  return WorkerDiscoveryDocumentSchema.parse({discoveryVersion:1,
    controlPlanes:result}).controlPlanes;
}
