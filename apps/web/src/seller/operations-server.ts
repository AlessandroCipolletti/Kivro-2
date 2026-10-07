import { PostgresSellerOperations } from '../../../../packages/persistence/src/seller-operations.js';
import { getMarketplaceService } from '../marketplace/server.js';

let shared:PostgresSellerOperations|undefined;
export function getSellerOperations():PostgresSellerOperations{
  const service=getMarketplaceService();
  return shared??=new PostgresSellerOperations(service.pool,service.availability,service.finance);
}
