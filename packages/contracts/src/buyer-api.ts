import { z } from 'zod';
import { JobStatusSchema } from './job-lifecycle.js';

/** Frozen v1 commercial response; a later price publication cannot alter this contract. */
export const BuyerApiJobCreatedSchema=z.strictObject({
  apiVersion:z.literal('v1'),jobId:z.uuid(),status:JobStatusSchema,
  capabilityId:z.uuid(),capabilityVersion:z.number().int().positive(),
  price:z.strictObject({currency:z.literal('USD'),amountMinor:z.number().int().positive()})
});
export const BuyerWebhookEnvelopeSchema=z.strictObject({
  id:z.string().regex(/^evt_[0-9a-f-]{36}$/),
  type:z.enum(['job.completed','job.failed','job.cancelled','job.started','test.ping']),
  createdAt:z.iso.datetime({offset:true}),
  data:z.union([z.strictObject({test:z.literal(true)}),z.strictObject({
    jobId:z.uuid(),capabilityId:z.uuid(),capabilityVersion:z.number().int().positive(),
    status:JobStatusSchema})])
});
