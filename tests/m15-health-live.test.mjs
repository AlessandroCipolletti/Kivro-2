import test from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
import { GET as ready } from '../dist/apps/web/app/health/ready/route.js';
import { getMarketplaceService } from '../dist/apps/web/src/marketplace/server.js';

test('cloud readiness succeeds only with real local database, private storage and scanner',
  {skip:process.env.KIVRO_LIVE_HEALTH!=='1'},async()=>{
    try{
      const response=await ready();
      assert.equal(response.status,200);
      assert.deepEqual(await response.json(),{status:'READY'});
      assert.equal(response.headers.get('cache-control'),'no-store');
    }finally{await getMarketplaceService().pool.end();}
  });
