import assert from 'node:assert/strict';
import process from 'node:process';
import test from 'node:test';
import {handleWorkerDiscovery} from '../dist/apps/web/src/worker/discovery-handler.js';

const keys=['APP_ORIGIN','KIVRO_CONTROL_PLANE_ID','KIVRO_CONTROL_PLANE_STATE',
  'KIVRO_ALLOW_LOCAL_HTTP','KIVRO_WORKER_DISCOVERY_PLANES_JSON','NODE_ENV'];
function environment(values,fn){
  const old=Object.fromEntries(keys.map((key)=>[key,process.env[key]]));
  try{for(const key of keys){
    if(values[key]===undefined)delete process.env[key];
    else process.env[key]=values[key];
  }return fn();}
  finally{for(const key of keys){
    if(old[key]===undefined)delete process.env[key];
    else process.env[key]=old[key];
  }}
}
const request=new globalThis.Request('http://127.0.0.1:3000/.well-known/kivro-worker');
const base={NODE_ENV:'development',APP_ORIGIN:'http://localhost:3000',
  KIVRO_ALLOW_LOCAL_HTTP:'true',KIVRO_CONTROL_PLANE_ID:'local-primary',
  KIVRO_CONTROL_PLANE_STATE:'ACTIVE'};

test('Web publishes a bounded no-store Worker discovery document from explicit configuration',async()=>{
  const response=environment(base,()=>handleWorkerDiscovery(request));
  assert.equal(response.status,200);
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.deepEqual(await response.json(),{discoveryVersion:1,controlPlanes:[{
    id:'local-primary',state:'ACTIVE',endpoint:'http://localhost:3000',
    transports:[{type:'POLLING',version:1,endpoint:'http://localhost:3000'}]}]});
});

test('dual-plane discovery requires own exact identity and one active safe destination',async()=>{
  const dual={discoveryVersion:1,controlPlanes:[
    {id:'old',state:'DRAINING',endpoint:'https://old.example.test'},
    {id:'local-primary',state:'ACTIVE',endpoint:'http://localhost:3000'}]};
  const accepted=environment({...base,KIVRO_WORKER_DISCOVERY_PLANES_JSON:JSON.stringify(dual)},
    ()=>handleWorkerDiscovery(request));
  assert.equal(accepted.status,200);
  assert.equal((await accepted.json()).controlPlanes.length,2);
  const wrong=environment({...base,KIVRO_CONTROL_PLANE_STATE:'DRAINING',
    KIVRO_WORKER_DISCOVERY_PLANES_JSON:JSON.stringify(dual)},
  ()=>handleWorkerDiscovery(request));
  assert.equal(wrong.status,503);
  const unsafe=environment({...base,KIVRO_WORKER_DISCOVERY_PLANES_JSON:JSON.stringify({
    ...dual,controlPlanes:[{...dual.controlPlanes[0],endpoint:'http://169.254.169.254/'},
      dual.controlPlanes[1]]})},()=>handleWorkerDiscovery(request));
  assert.equal(unsafe.status,503);
});

test('production discovery never downgrades to loopback HTTP or implicit ACTIVE',()=>{
  assert.equal(environment({...base,NODE_ENV:'production'},
    ()=>handleWorkerDiscovery(request)).status,503);
  assert.equal(environment({...base,KIVRO_CONTROL_PLANE_STATE:undefined},
    ()=>handleWorkerDiscovery(request)).status,503);
});
