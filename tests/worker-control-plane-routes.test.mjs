import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {WorkerControlPlaneRoutes,restoreOwnedControlPlaneRoutes} from
  '../dist/apps/worker/src/control-plane-routes.js';

const old={id:'netsons-old',state:'ACTIVE',endpoint:'https://old.example.test'};
const next={id:'aws-new',state:'ACTIVE',endpoint:'https://new.example.test',
  transports:[{type:'POLLING',version:1,endpoint:'https://new.example.test'},
    {type:'WEBSOCKET',version:1,endpoint:'wss://new.example.test/worker/socket'}]};

test('restart restores only owned old polling route as draining beside new WSS',()=>{
  const root=mkdtempSync(join(tmpdir(),'kivro-plane-routes-'));
  try{
    let routes=new WorkerControlPlaneRoutes(root);
    routes.remember(old);routes.close();
    routes=new WorkerControlPlaneRoutes(root);
    const restored=restoreOwnedControlPlaneRoutes([next],new Set([old.id]),routes);
    assert.equal(restored.length,2);
    assert.equal(restored[0].state,'ACTIVE');
    assert.equal(restored[0].transports[1].type,'WEBSOCKET');
    assert.deepEqual(restored[1],{...old,state:'DRAINING'});
    assert.deepEqual(restoreOwnedControlPlaneRoutes([next],new Set(),routes),[next],
      'a cached plane never receives new work without owned state');
    routes.forget(old.id);
    assert.throws(()=>restoreOwnedControlPlaneRoutes([next],new Set([old.id]),routes),
      /WORKER_OWNED_PLANE_ROUTE_MISSING/);
    routes.close();
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('unknown or third owned control plane fails closed on restart',()=>{
  const root=mkdtempSync(join(tmpdir(),'kivro-plane-routes-'));
  const routes=new WorkerControlPlaneRoutes(root);
  try{
    routes.remember(old);
    assert.throws(()=>restoreOwnedControlPlaneRoutes([next],
      new Set(['unknown']),routes),/WORKER_OWNED_PLANE_ROUTE_MISSING/);
    assert.throws(()=>restoreOwnedControlPlaneRoutes([next],
      new Set([old.id,'third']),routes),/WORKER_OWNED_PLANE_ROUTE_MISSING/);
    assert.throws(()=>routes.remember({...old,endpoint:'invalid'}));
  }finally{routes.close();rmSync(root,{recursive:true,force:true});}
});
