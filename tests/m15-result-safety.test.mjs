import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { ClamAvSocketScanner, MalwareScanError } from
  '../dist/packages/infrastructure/adapters/src/clamav-scanner.js';
import { verifyResultFileType, ResultFileSafetyError } from
  '../dist/packages/application/src/result-file-safety.js';
import { safeResultFileName } from '../dist/packages/contracts/src/file-types.js';

async function withScanner(reply,action){
  const root=await mkdtemp(join(tmpdir(),'kivro-scan-'));
  const path=join(root,'clamd.sock');
  let received=Buffer.alloc(0);
  const server=createServer((socket)=>{
    socket.on('data',(part)=>{
      received=Buffer.concat([received,part]);
      if(received.subarray(0,6).toString('binary')==='zPING\0'){
        socket.end('PONG\0');return;
      }
      if(received.subarray(0,10).toString('binary')!=='zINSTREAM\0')return;
      let offset=10;
      while(offset+4<=received.length){
        const length=received.readUInt32BE(offset);offset+=4;
        if(length===0){socket.end(reply+'\0');return;}
        if(offset+length>received.length)return;
        offset+=length;
      }
    });
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(path,resolve);});
  try{await action(new ClamAvSocketScanner(path),()=>received);}
  finally{await new Promise((resolve)=>server.close(resolve));await rm(root,{recursive:true,force:true});}
}

const socketTest=process.env.KIVRO_ALLOW_SOCKET_TESTS==='1'?test:test.skip;
socketTest('cloud scanner accepts only a full clamd clean verdict',async()=>{
  await withScanner('stream: OK',async(scanner,received)=>{
    assert.equal(await scanner.scan((async function*(){yield Buffer.from('abc');yield Buffer.from('def');})(),6),'CLEAN');
    assert.ok(received().includes(Buffer.from('abc')));
    assert.ok(received().includes(Buffer.from('def')));
  });
  await withScanner('stream: Eicar-Test-Signature FOUND',async(scanner)=>{
    await assert.rejects(scanner.scan((async function*(){yield Buffer.from('x');})(),1),
      (e)=>e instanceof MalwareScanError&&e.code==='INFECTED');
  });
  await withScanner('stream: ERROR',async(scanner)=>{
    await assert.rejects(scanner.scan((async function*(){yield Buffer.from('x');})(),1),
      (e)=>e instanceof MalwareScanError&&e.code==='INVALID_RESPONSE');
  });
});

socketTest('scan absence and over-limit bytes fail closed',async()=>{
  await assert.rejects(new ClamAvSocketScanner('/no/such/clamd.sock')
    .scan((async function*(){yield Buffer.from('x');})(),1),
    (e)=>e instanceof MalwareScanError&&e.code==='UNAVAILABLE');
  await withScanner('stream: OK',async(scanner)=>{
    await assert.rejects(scanner.scan((async function*(){yield Buffer.from('long');})(),2),
      (e)=>e instanceof MalwareScanError&&e.code==='LIMIT_EXCEEDED');
  });
});
socketTest('scanner readiness requires a live local clamd reply',async()=>{
  await withScanner('stream: OK',async(scanner)=>{
    await scanner.ping();
  });
  await assert.rejects(new ClamAvSocketScanner('/no/such/clamd.sock').ping(),
    (e)=>e instanceof MalwareScanError&&e.code==='UNAVAILABLE');
  assert.throws(()=>new ClamAvSocketScanner('tcp://192.168.0.1:3310'),
    (e)=>e instanceof MalwareScanError&&e.code==='UNAVAILABLE');
});

function storage(bytes){return {async readPrivateObject(){return (async function*(){yield bytes;})();}};}
test('cloud MIME re-identification rejects Worker claims and malformed text',async()=>{
  const png=Buffer.from([137,80,78,71,13,10,26,10,1,2,3]);
  await verifyResultFileType(storage(png),'private/key','image/png');
  await assert.rejects(verifyResultFileType(storage(png),'private/key','image/jpeg'),
    (e)=>e instanceof ResultFileSafetyError&&e.code==='UNSUPPORTED_TYPE');
  await assert.rejects(verifyResultFileType(storage(Buffer.from([0xff])),'private/key','text/plain'),
    (e)=>e instanceof ResultFileSafetyError&&e.code==='INVALID_TEXT');
  await assert.rejects(verifyResultFileType(storage(Buffer.from('{bad')),'private/key','application/json'),
    (e)=>e instanceof ResultFileSafetyError&&e.code==='INVALID_JSON');
  const id='11111111-1111-4111-8111-111111111111';
  assert.equal(safeResultFileName(id,'application/pdf'),`kivro-result-${id}.pdf`);
  assert.throws(()=>safeResultFileName(id,'text/html'),/Unsupported/);
});
