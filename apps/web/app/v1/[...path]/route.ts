import { handleBuyerV1 } from '../../../src/buyer-api/handler.js';

export const runtime='nodejs';
interface Context{params:Promise<{path:string[]}>}
async function handle(request:Request,context:Context){
  return handleBuyerV1(request,(await context.params).path);
}
export const GET=handle;
export const POST=handle;
export const PATCH=handle;
export const DELETE=handle;
