import { randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import pg from 'pg';
import { z } from 'zod';
import { LocalCapabilityPackageSchema, type LocalCapabilityPackage } from
  '../../../packages/contracts/src/capability-package.js';
import type { ReadOnlyResourceOperation } from
  '../../../packages/contracts/src/local-resource-policy.js';
import { LocalResourceBroker } from '../../../packages/application/src/local-resource-broker.js';
import { DeclaredApiBroker, type DeclaredApiConnector } from
  '../../../packages/application/src/declared-api-broker.js';
import { PostgresReadOnlyResourceAdapter } from
  '../../../packages/persistence/src/postgres-readonly-resource.js';
import { NodePinnedPublicHttpTransport } from
  '../../../packages/infrastructure/http/src/pinned-http.js';
import { isPublicInternetAddress, NetworkPolicyError } from
  '../../../packages/policy-engine/src/public-destination.js';
import type { DeclaredApiUsagePort, LocalResourceAuditPort,
  LocalResourceQueryPort } from
  '../../../packages/infrastructure/contracts/src/research-ports.js';
import { openPrivateWorkerSqlite } from './local-state.js';
import type { SellerCredentialVault } from
  '../../../packages/application/src/provider-broker.js';
import type { JobBrokerPorts } from './broker-router.js';
import { SelectedLocalFileBroker, verifySelectedLocalBinding,
  type SelectedFileAuditPort } from './selected-local-file.js';
type WorkerVault=SellerCredentialVault&{exists(ref:string):Promise<boolean>};

/** Durable, seller-local audit and request-count limits. No query values,
 * credentials or API response bodies are persisted. */
export class WorkerResourceUsage implements LocalResourceAuditPort,DeclaredApiUsagePort,
  SelectedFileAuditPort {
  private readonly db;
  constructor(stateDir:string){
    this.db=openPrivateWorkerSqlite(stateDir,'resource-usage.sqlite');
    this.db.exec(`CREATE TABLE IF NOT EXISTS private_resource_reads (
      job_id TEXT NOT NULL, capability_version_id TEXT NOT NULL,
      first_read_at TEXT NOT NULL, PRIMARY KEY(job_id,capability_version_id));
      CREATE TABLE IF NOT EXISTS local_resource_audit (
      id TEXT PRIMARY KEY,job_id TEXT NOT NULL,capability_version_id TEXT NOT NULL,
      resource_id TEXT NOT NULL,operation_id TEXT NOT NULL,row_count INTEGER NOT NULL,
      status TEXT NOT NULL,reason TEXT,occurred_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS declared_api_usage (
      request_id TEXT PRIMARY KEY,job_id TEXT NOT NULL,
      capability_version_id TEXT NOT NULL,connector_id TEXT NOT NULL,
      host TEXT NOT NULL,method TEXT NOT NULL,status TEXT NOT NULL,
      response_bytes INTEGER NOT NULL DEFAULT 0,reason TEXT,
      created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS selected_file_audit (
      id TEXT PRIMARY KEY,job_id TEXT NOT NULL,capability_version_id TEXT NOT NULL,
      resource_id TEXT NOT NULL,file_id TEXT NOT NULL,bytes INTEGER NOT NULL,
      status TEXT NOT NULL,reason TEXT,occurred_at TEXT NOT NULL);`);
  }
  close():void{this.db.close();}
  async markPrivateResourceRead(jobId:string,capabilityVersionId:string):Promise<void>{
    this.db.prepare(`INSERT OR IGNORE INTO private_resource_reads
      (job_id,capability_version_id,first_read_at) VALUES(?,?,?)`)
      .run(z.uuid().parse(jobId),z.uuid().parse(capabilityVersionId),
        new Date().toISOString());
  }
  async record(input:Parameters<LocalResourceAuditPort['record']>[0]):Promise<void>{
    this.db.prepare(`INSERT INTO local_resource_audit(id,job_id,capability_version_id,
      resource_id,operation_id,row_count,status,reason,occurred_at)
      VALUES(?,?,?,?,?,?,?,?,?)`).run(randomUUID(),z.uuid().parse(input.jobId),
        z.uuid().parse(input.capabilityVersionId),input.resourceId,input.operationId,
        input.rowCount,input.status,input.reason,input.occurredAt);
  }
  async recordSelectedFile(input:Parameters<SelectedFileAuditPort['recordSelectedFile']>[0]):
    Promise<void>{
    this.db.prepare(`INSERT INTO selected_file_audit(id,job_id,capability_version_id,
      resource_id,file_id,bytes,status,reason,occurred_at) VALUES(?,?,?,?,?,?,?,?,?)`)
      .run(randomUUID(),z.uuid().parse(input.jobId),
        z.uuid().parse(input.capabilityVersionId),input.resourceId,input.fileId,
        input.bytes,input.status,input.reason,new Date().toISOString());
  }
  async begin(input:Parameters<DeclaredApiUsagePort['begin']>[0]):Promise<void>{
    this.db.exec('BEGIN IMMEDIATE');
    try{
      const prior=this.db.prepare(`SELECT job_id,capability_version_id,connector_id,host,
        method FROM declared_api_usage WHERE request_id=?`).get(input.requestId) as
        {job_id:string;capability_version_id:string;connector_id:string;host:string;
          method:string}|undefined;
      if(prior){
        if(prior.job_id!==input.jobId||prior.capability_version_id!==input.capabilityVersionId||
          prior.connector_id!==input.connectorId||prior.host!==input.host||
          prior.method!==input.method)throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
        // A replay cannot invoke an external API a second time.
        throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
      }
      const count=this.db.prepare(`SELECT count(*) AS n FROM declared_api_usage
        WHERE job_id=? AND capability_version_id=? AND connector_id=?`).get(
          input.jobId,input.capabilityVersionId,input.connectorId) as {n:number};
      if(count.n>=input.maxRequestsPerJob)
        throw new NetworkPolicyError('NETWORK_BUDGET_EXCEEDED');
      this.db.prepare(`INSERT INTO declared_api_usage(request_id,job_id,
        capability_version_id,connector_id,host,method,status,created_at)
        VALUES(?,?,?,?,?,?,'STARTED',?)`).run(input.requestId,input.jobId,
          input.capabilityVersionId,input.connectorId,input.host,input.method,
          new Date().toISOString());
      this.db.exec('COMMIT');
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  async finish(input:Parameters<DeclaredApiUsagePort['finish']>[0]):Promise<void>{
    this.db.prepare(`UPDATE declared_api_usage SET status=?,response_bytes=?,reason=?
      WHERE request_id=? AND status='STARTED'`).run(input.status,input.responseBytes,
        input.reason,input.requestId);
  }
  async deny(input:Parameters<DeclaredApiUsagePort['deny']>[0]):Promise<void>{
    this.db.prepare(`INSERT INTO declared_api_usage(request_id,job_id,
      capability_version_id,connector_id,host,method,status,reason,created_at)
      VALUES(?,?,?,?,?,'DENIED','DENIED',?,?)`).run(randomUUID(),input.jobId,
        input.capabilityVersionId,input.connectorId,'REDACTED',input.reason,
        new Date().toISOString());
  }
}

/** One query, one dedicated read-only credential and one short-lived pool.
 * The OpenClaw sandbox never receives the DSN or a database socket. */
class VaultReadOnlyQuery implements LocalResourceQueryPort {
  constructor(private readonly vault:SellerCredentialVault,
    private readonly credentialRef:string){}
  async query(operation:ReadOnlyResourceOperation,lookup:string,timeoutMs:number){
    const dsn=await this.vault.resolve(this.credentialRef);
    const url=new URL(dsn);
    if(!['postgres:','postgresql:'].includes(url.protocol)||!url.hostname||
      url.hash)throw new Error('RESOURCE_CREDENTIAL_UNSAFE');
    const pool=new pg.Pool({connectionString:dsn,max:1,
      connectionTimeoutMillis:Math.min(timeoutMs,5000),idleTimeoutMillis:1000});
    try{return await new PostgresReadOnlyResourceAdapter(pool)
      .query(operation,lookup,timeoutMs);}
    finally{await pool.end();}
  }
}

const apiParameters=z.record(z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,39}$/),
  z.string().max(200)).refine((value)=>Object.keys(value).length<=16);

class FixedReadOnlyApiConnector implements DeclaredApiConnector<
  z.infer<typeof apiParameters>,unknown> {
  readonly sideEffect='READ_ONLY' as const;
  readonly input=apiParameters;
  readonly output=z.unknown();
  private readonly transport=new NodePinnedPublicHttpTransport();
  constructor(readonly id:string,readonly host:string,
    readonly method:'GET'|'HEAD',readonly path:string,
    private readonly maxBytes:number,private readonly credentialRef:string|null,
    private readonly vault:SellerCredentialVault){}
  async invoke(input:z.infer<typeof apiParameters>):Promise<unknown>{
    const url=new URL(`https://${this.host}${this.path}`);
    for(const [key,value] of Object.entries(input).sort(([a],[b])=>a.localeCompare(b)))
      url.searchParams.set(key,value);
    const addresses=isIP(this.host)?[this.host]:
      (await lookup(this.host,{all:true,verbatim:true})).map((item)=>item.address);
    if(addresses.length===0||addresses.some((address)=>!isPublicInternetAddress(address)))
      throw new NetworkPolicyError('PRIVATE_DESTINATION_DENIED');
    const secret=this.credentialRef?await this.vault.resolve(this.credentialRef):null;
    const response=await this.transport.request({url,pinnedAddress:addresses[0]!,
      method:this.method,maxBytes:this.maxBytes,timeoutMs:10_000,
      headers:secret?{Authorization:`Bearer ${secret}`}:{}});
    if(response.status<200||response.status>=300)
      throw new NetworkPolicyError('SOURCE_UNAVAILABLE');
    if(this.method==='HEAD')return {status:response.status};
    const contentType=response.headers['content-type']?.split(';',1)[0]?.trim();
    if(contentType!=='application/json')
      throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
    try{return JSON.parse(Buffer.from(response.body).toString('utf8')) as unknown;}
    catch{throw new NetworkPolicyError('NETWORK_POLICY_DENIED');}
  }
}

/** Exact reviewed package → actual broker ports. Missing local credentials or
 * a changed connector fail before a paid job can enter the sandbox. */
export function createWorkerResourcePorts(rawPackage:unknown,
  vault:SellerCredentialVault,usage:WorkerResourceUsage,
  cloudPrivateRead?: (jobId:string,capabilityVersionId:string)=>Promise<void>):Pick<JobBrokerPorts,
    'localResources'|'declaredApi'|'selectedFiles'>{
  const pkg:LocalCapabilityPackage=LocalCapabilityPackageSchema.parse(rawPackage);
  const privateRead={
    markPrivateResourceRead:async(jobId:string,capabilityVersionId:string)=>{
      if(pkg.permissionPolicy.internet?.mode==='PUBLIC_WEB_RESEARCH'){
        if(!cloudPrivateRead)throw new Error('RESEARCH_PRIVATE_READ_BARRIER_UNAVAILABLE');
        await cloudPrivateRead(jobId,capabilityVersionId);
      }
      await usage.markPrivateResourceRead(jobId,capabilityVersionId);
    },
    recordSelectedFile:(event:Parameters<WorkerResourceUsage['recordSelectedFile']>[0])=>
      usage.recordSelectedFile(event),
  };
  const resources=new Map<string,LocalResourceBroker>();
  for(const policy of pkg.permissionPolicy.localResources??[]){
    const manifest=pkg.workerManifest.resources.find((item)=>
      item.id===policy.resourceId&&item.type==='local-resource-broker');
    if(!manifest?.credentialRef)throw new Error('RESOURCE_CREDENTIAL_UNAVAILABLE');
    resources.set(policy.resourceId,new LocalResourceBroker(
      new VaultReadOnlyQuery(vault,manifest.credentialRef),policy,usage,privateRead));
  }
  const connectors=new Map<string,DeclaredApiConnector<unknown,unknown>>();
  const selectedFiles=new Map<string,SelectedLocalFileBroker>();
  for(const binding of pkg.selectedLocalBindings??[])
    selectedFiles.set(binding.resourceId,new SelectedLocalFileBroker(binding,privateRead));
  const apiPolicy=pkg.permissionPolicy.declaredApiPolicy??pkg.permissionPolicy.internet;
  if(apiPolicy?.mode==='DECLARED_API_ACCESS'){
    for(const declared of apiPolicy.connectors){
      const manifest=pkg.workerManifest.resources.find((item)=>
        item.id===declared.id&&item.type==='declared-api');
      if(!manifest||declared.method==='POST')throw new Error('DECLARED_API_UNSAFE');
      connectors.set(declared.id,new FixedReadOnlyApiConnector(declared.id,
        declared.host,declared.method,declared.path,declared.maxResponseBytes,
        manifest.credentialRef??null,vault));
    }
  }
  return {
    ...(resources.size?{localResources:resources}:{}),
    ...(connectors.size?{declaredApi:new DeclaredApiBroker(connectors,usage)}:{}),
    ...(selectedFiles.size?{selectedFiles}:{}),
  };
}

/** Admission validates every named dependency before a paid offer is accepted.
 * The database probe runs through the same read-only adapter and dedicated
 * credential; API readiness checks DNS and credential presence without making
 * a seller-side request to a potentially stateful third-party service. */
export async function checkWorkerResourceReadiness(rawPackage:unknown,
  vault:WorkerVault):Promise<boolean>{
  const pkg=LocalCapabilityPackageSchema.parse(rawPackage);
  try{
    for(const ref of pkg.permissionPolicy.sellerCredentialRefs)
      if(!await vault.exists(ref))return false;
    for(const binding of pkg.selectedLocalBindings??[])
      if(!await verifySelectedLocalBinding(binding))return false;
    for(const policy of pkg.permissionPolicy.localResources??[]){
      const binding=pkg.workerManifest.resources.find((item)=>
        item.id===policy.resourceId&&item.type==='local-resource-broker');
      if(!binding?.credentialRef||!await vault.exists(binding.credentialRef))return false;
      const probe=policy.operations[0];
      if(!probe)return false;
      await new VaultReadOnlyQuery(vault,binding.credentialRef)
        .query(probe,'__kivro_readiness_probe__',policy.statementTimeoutMs);
    }
    const apiPolicy=pkg.permissionPolicy.declaredApiPolicy??pkg.permissionPolicy.internet;
    if(apiPolicy?.mode==='DECLARED_API_ACCESS'){
      for(const connector of apiPolicy.connectors){
        if(connector.method==='POST')return false;
        const binding=pkg.workerManifest.resources.find((item)=>
          item.id===connector.id&&item.type==='declared-api');
        if(!binding||binding.credentialRef&&
          !await vault.exists(binding.credentialRef))return false;
        const addresses=(await lookup(connector.host,{all:true,verbatim:true}))
          .map((item)=>item.address);
        if(!addresses.length||addresses.some((address)=>
          !isPublicInternetAddress(address)))return false;
      }
    }
    return true;
  }catch{return false;}
}
