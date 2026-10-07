export const runtime='nodejs';
export async function GET():Promise<Response>{
  return Response.json({status:'LIVE'},{headers:{'Cache-Control':'no-store'}});
}
