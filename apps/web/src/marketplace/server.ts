import { PostgresFinanceRepository } from '../../../../packages/persistence/src/finance.js';
import { PostgresAvailabilityRepository } from '../../../../packages/persistence/src/availability.js';
import { PostgresJobExecutionRepository } from '../../../../packages/persistence/src/job-execution.js';
import { MarketplaceCatalog } from '../../../../packages/persistence/src/marketplace-catalog.js';
import { MarketplaceSocialRepository } from '../../../../packages/persistence/src/marketplace-social.js';
import { MarketplaceBuyerRepository } from '../../../../packages/persistence/src/marketplace-buyer.js';
import { MarketplaceAssetRepository } from '../../../../packages/persistence/src/marketplace-assets.js';
import { leaseTokenIssuerFromEnvironment } from '../../../../packages/application/src/lease-token.js';
import { S3PrivateObjectStorage } from '../../../../packages/infrastructure/s3/src/storage.js';
import { getAuthService } from '../auth/server.js';

function required(key:string):string {
  const value=process.env[key];if(!value)throw new Error(`Missing marketplace configuration: ${key}`);
  return value;
}
function mode(): 'test'|'live' {
  const value=required('KIVRO_STRIPE_MODE');
  if(value!=='test'&&value!=='live')throw new Error('Invalid Stripe mode');
  return value;
}
let shared: ReturnType<typeof construct> | undefined;
function construct(){
  const pool=getAuthService().database;
  const finance=new PostgresFinanceRepository(pool,mode());
  const availability=new PostgresAvailabilityRepository(pool,finance);
  const catalog=new MarketplaceCatalog(pool,availability);
  const social=new MarketplaceSocialRepository(pool);
  // Browsing can work without Worker lease or storage credentials. Actions that
  // need those security boundaries fail closed when configuration is missing.
  let buyer:MarketplaceBuyerRepository|undefined;
  let storage:S3PrivateObjectStorage|undefined;
  let assets:MarketplaceAssetRepository|undefined;
  const getBuyer=()=>buyer??=new MarketplaceBuyerRepository(pool,availability,finance,
    new PostgresJobExecutionRepository(pool,finance,leaseTokenIssuerFromEnvironment(process.env),availability));
  const getStorage=()=>storage??=new S3PrivateObjectStorage({
    bucket:required('OBJECT_STORAGE_BUCKET'),region:required('OBJECT_STORAGE_REGION'),
    ...(process.env.OBJECT_STORAGE_ENDPOINT?{endpoint:process.env.OBJECT_STORAGE_ENDPOINT}:{}),
    ...(process.env.OBJECT_STORAGE_ACCESS_KEY_ID&&process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY?
      {accessKeyId:process.env.OBJECT_STORAGE_ACCESS_KEY_ID,
        secretAccessKey:process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY}:{}),
    allowInsecureLoopback:process.env.NODE_ENV!=='production',
  });
  const getAssets=()=>assets??=new MarketplaceAssetRepository(pool,getStorage());
  return {pool,finance,availability,catalog,social,getBuyer,getStorage,getAssets};
}
export function getMarketplaceService(){return shared??=construct();}
