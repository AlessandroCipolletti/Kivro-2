import test from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { ClamAvSocketScanner, MalwareScanError } from
  '../dist/packages/infrastructure/adapters/src/clamav-scanner.js';

const endpoint=process.env.KIVRO_CLAMAV_SOCKET;
test('live clamd loads signatures and distinguishes clean bytes from EICAR',
  {skip:!endpoint},async()=>{
    const scanner=new ClamAvSocketScanner(endpoint);
    await scanner.ping();
    const clean=Buffer.from('Kivro benign result fixture\n');
    assert.equal(await scanner.scan((async function*(){yield clean;})(),clean.length),'CLEAN');
    // Standard harmless EICAR antivirus test signature, assembled in memory.
    const sample=Buffer.from(['X5O!P%@AP[4\\PZX54(P^)7CC)7}',
      '$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'].join(''));
    await assert.rejects(scanner.scan((async function*(){yield sample;})(),sample.length),
      (error)=>error instanceof MalwareScanError&&error.code==='INFECTED');
  });
