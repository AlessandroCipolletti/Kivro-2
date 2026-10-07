import { getMarketplaceService } from '../../../src/marketplace/server.js';
import { ClamAvSocketScanner } from '../../../../../packages/infrastructure/adapters/src/clamav-scanner.js';
export const runtime='nodejs';
export async function GET():Promise<Response>{
  try{
    const app=getMarketplaceService();
    const db=await app.pool.query('SELECT 1 FROM platform_dispatch_control WHERE singleton=true');
    if(db.rowCount!==1)throw new Error('CONTROL_MISSING');
    await app.getStorage().checkAvailable();
    if(!process.env.KIVRO_CLAMAV_SOCKET)throw new Error('SCANNER_UNCONFIGURED');
    await new ClamAvSocketScanner(process.env.KIVRO_CLAMAV_SOCKET).ping();
    return Response.json({status:'READY'},{headers:{'Cache-Control':'no-store'}});
  }catch{
    return Response.json({status:'NOT_READY'},{status:503,
      headers:{'Cache-Control':'no-store'}});
  }
}
