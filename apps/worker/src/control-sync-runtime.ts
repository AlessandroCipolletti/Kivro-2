import { homedir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { closeSync, constants, fstatSync, openSync, readFileSync } from 'node:fs';
import { EncryptedDeviceIdentityStore, KeychainDeviceIdentityStore,
  type DeviceIdentitySigner } from './device-identity.js';
import { WorkerLocalState } from './local-state.js';
import { localHealth } from './health.js';
import { WorkerControlSync } from './control-sync.js';
import { WorkerJobControl } from './job-control.js';
import { DockerJobControlAdapter } from '../../../packages/sandbox-adapter/src/docker.js';
import { discoverWorkerControlPlanes, HttpsPollingWorkerTransport } from
  '../../../packages/infrastructure/netsons/src/https-polling.js';

function privatePassphrase(path:string):string{
  if(constants.O_NOFOLLOW===undefined)throw new Error('PRIVATE_PASSPHRASE_UNAVAILABLE');
  const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);
  try{
    const stat=fstatSync(fd);
    if(!stat.isFile()||(stat.mode&0o077)!==0||stat.size>4096||
      (typeof process.getuid==='function'&&stat.uid!==process.getuid()))
      throw new Error('INSECURE_PASSPHRASE_FILE');
    return readFileSync(fd,'utf8').replace(/\r?\n$/,'');
  }finally{closeSync(fd);}
}

async function unlockIdentity(directory:string):Promise<DeviceIdentitySigner>{
  const keychain=new KeychainDeviceIdentityStore(directory);
  try{return await keychain.unlock();}
  catch(error){
    if(!(error instanceof Error&&'code' in error&&error.code==='NOT_FOUND'))throw error;
  }
  const file=process.env.KIVRO_WORKER_PASSPHRASE_FILE;
  if(!file)throw new Error('WORKER_IDENTITY_NOT_UNLOCKED');
  return new EncryptedDeviceIdentityStore(directory).unlock(privatePassphrase(file));
}

/** Host-native composition for the M12 control channel. Paid capacity stays zero
 * until the M13 authenticated job RPC composition is available. */
export async function runWorkerControlSync(signal:AbortSignal):Promise<void>{
  const directory=process.env.KIVRO_WORKER_STATE_DIR??
    join(homedir(),'.kivro','worker','state');
  const discoveryUrl=process.env.WORKER_DISCOVERY_URL;
  if(!discoveryUrl)throw new Error('WORKER_DISCOVERY_NOT_CONFIGURED');
  const signer=await unlockIdentity(directory);
  const local=new WorkerLocalState(directory,{check:async()=>({ready:false,
    checkedAt:new Date().toISOString(),blockingReasons:['CONTROL_ONLY_MODE']})});
  let jobControl:WorkerJobControl|undefined;
  try{
    try{
      const docker=execFileSync('which',['docker'],{encoding:'utf8',timeout:2_000,
        stdio:['ignore','pipe','ignore']}).trim();
      jobControl=new WorkerJobControl(directory,new DockerJobControlAdapter(docker),
        {check:async()=>({ready:false,checkedAt:new Date().toISOString(),
          blockingReasons:['CONTROL_ONLY_MODE']})},{maxPauseDurationMs:14_400_000});
      await jobControl.stopOrphanedAtStartup();
    }catch(error){
      if(jobControl)throw error;
      // Docker is unavailable: control sync still reports NOT_READY and zero capacity.
    }
    const allowLocalHttp=process.env.KIVRO_ALLOW_LOCAL_HTTP==='true'&&
      process.env.NODE_ENV!=='production';
    const planes=await discoverWorkerControlPlanes(discoveryUrl,{allowLocalHttp});
    const active=planes.filter((plane)=>plane.state==='ACTIVE');
    if(planes.length!==1||active.length!==1||!active[0])
      throw new Error('CONTROL_ONLY_REQUIRES_SINGLE_ACTIVE_PLANE');
    const transport=new HttpsPollingWorkerTransport(active[0].id,active[0].endpoint,
      signer,{allowLocalHttp});
    const sync=new WorkerControlSync(transport,signer.deviceId,local,
      ()=>localHealth(directory,local.snapshot(),'METADATA_PRESENT',0,false,signer.deviceId),
      process.env.KIVRO_WORKER_RELEASE??'0.0.0-dev',jobControl);
    await sync.runUntilAborted(signal);
  }finally{jobControl?.close();local.close();}
}
