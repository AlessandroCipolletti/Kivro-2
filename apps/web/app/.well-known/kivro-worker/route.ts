import { z } from 'zod';

/** Stable, public discovery document. It grants no Worker authority. */
export function GET():Response{
  const id=z.string().min(1).max(160).parse(process.env.KIVRO_CONTROL_PLANE_ID);
  const state=z.enum(['ACTIVE','DRAINING']).parse(
    process.env.KIVRO_CONTROL_PLANE_STATE??'ACTIVE');
  const endpoint=z.url().parse(process.env.APP_ORIGIN);
  const url=new URL(endpoint);
  if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||
    (url.protocol!=='https:'&&!(process.env.NODE_ENV!=='production'&&
      url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname))))
    throw new Error('WORKER_DISCOVERY_CONFIGURATION_INVALID');
  return Response.json({discoveryVersion:1,controlPlanes:[{id,state,endpoint:url.origin+'/'}]},
    {headers:{'Cache-Control':'public, max-age=30',
      'X-Content-Type-Options':'nosniff'}});
}
