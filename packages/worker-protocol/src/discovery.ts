import {z} from 'zod';

export const WorkerDiscoveryTransportSchema=z.strictObject({
  type:z.enum(['POLLING','WEBSOCKET']),
  version:z.literal(1),
  endpoint:z.url(),
});

export const WorkerDiscoveryPlaneSchema=z.strictObject({
  id:z.string().min(1).max(160),
  state:z.enum(['ACTIVE','DRAINING']),
  endpoint:z.url(),
  transports:z.array(WorkerDiscoveryTransportSchema).min(1).max(2).optional(),
}).superRefine((plane,context)=>{
  if(plane.transports&&new Set(plane.transports.map((transport)=>transport.type)).size!==
    plane.transports.length)
    context.addIssue({code:'custom',message:'Duplicate transport type'});
});

export const WorkerDiscoveryDocumentSchema=z.strictObject({
  discoveryVersion:z.literal(1),
  controlPlanes:z.array(WorkerDiscoveryPlaneSchema).min(1).max(2),
}).superRefine((document,context)=>{
  if(document.controlPlanes.filter((plane)=>plane.state==='ACTIVE').length!==1||
    new Set(document.controlPlanes.map((plane)=>plane.id)).size!==document.controlPlanes.length)
    context.addIssue({code:'custom',message:'Exactly one active plane and unique IDs required'});
});

export type WorkerDiscoveryDocument=z.infer<typeof WorkerDiscoveryDocumentSchema>;
