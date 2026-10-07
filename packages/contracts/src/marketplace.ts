import { z } from 'zod';
import { PublicAvailabilitySchema } from './availability.js';
import { PriceSnapshotSchema } from './pricing.js';
import { CapabilityIOContractSchema } from './capability-io.js';
import { PublicPermissionManifestSchema } from './permission-policy.js';

export const MarketplaceCategorySchema = z.enum([
  'RESEARCH', 'DATA_ANALYSIS', 'DOCUMENTS', 'DEVELOPMENT', 'MEDIA', 'BUSINESS', 'OTHER',
]);
export type MarketplaceCategory = z.infer<typeof MarketplaceCategorySchema>;

export const MarketplaceSearchSchema = z.strictObject({
  query: z.string().trim().max(160).default(''),
  category: MarketplaceCategorySchema.optional(),
  minimumPriceMinor: z.number().int().min(0).max(100_000).optional(),
  maximumPriceMinor: z.number().int().min(0).max(100_000).optional(),
  minimumRating: z.number().min(1).max(5).optional(),
  onlineNow: z.boolean().default(false),
  outputType: z.enum(['TEXT', 'STRUCTURED', 'FILE', 'IMAGE', 'VIDEO', 'AUDIO', 'PDF']).optional(),
  maximumRuntimeSeconds: z.number().int().positive().max(86_400).optional(),
  sort: z.enum(['RELEVANCE', 'RATING', 'MOST_USED', 'PRICE_ASC', 'PRICE_DESC', 'FASTEST'])
    .default('RELEVANCE'),
  limit: z.number().int().min(1).max(48).default(24),
  offset: z.number().int().nonnegative().max(1_000_000).default(0),
});
export type MarketplaceSearch = z.infer<typeof MarketplaceSearchSchema>;

export const RatingSummarySchema = z.strictObject({
  average: z.number().min(1).max(5).nullable(),
  count: z.number().int().nonnegative(),
  distribution: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative(),
    z.number().int().nonnegative(), z.number().int().nonnegative(), z.number().int().nonnegative()]),
});

export const CapabilityCardSchema = z.strictObject({
  id: z.uuid(), slug: z.string(), name: z.string(), shortDescription: z.string(),
  category: MarketplaceCategorySchema, tags: z.array(z.string()), sellerId: z.uuid(),
  sellerName: z.string(), versionId: z.uuid(), versionNumber: z.number().int().positive(),
  price: PriceSnapshotSchema, rating: RatingSummarySchema,
  completedJobs: z.number().int().nonnegative(), typicalRuntimeSeconds: z.number().int().nonnegative().nullable(),
  availability: PublicAvailabilitySchema, inputTypes:z.array(z.string()),
  outputTypes: z.array(z.string()),
  favorite: z.boolean(),
});
export type CapabilityCard = z.infer<typeof CapabilityCardSchema>;

export const CapabilityDetailSchema = CapabilityCardSchema.extend({
  description: z.string(), strengths: z.array(z.string()), limitations: z.array(z.string()),
  version: z.strictObject({ id: z.uuid(), number: z.number().int().positive(),
    ioContract: CapabilityIOContractSchema,
    permissionManifest: PublicPermissionManifestSchema,
    researchAccess: z.boolean(),
    executionModel: z.literal('ISOLATED_SELLER_OPENCLAW'),
  }),
  sellerMemberSince: z.iso.datetime(),
  reviews: z.array(z.strictObject({ id: z.uuid(), rating: z.number().int().min(1).max(5),
    text: z.string(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime() })),
  examples: z.array(z.strictObject({ id: z.uuid(), title: z.string(), description: z.string(),
    source: z.enum(['REAL_EXECUTION', 'SELLER_CURATED']), inputValues: z.record(z.string(), z.unknown()),
    outputValues: z.record(z.string(), z.unknown()),
    inputAssets: z.array(z.strictObject({ fieldKey: z.string(), assetId: z.uuid(), mimeType: z.string(),
      sizeBytes: z.number().int().nonnegative() })),
    outputAssets: z.array(z.strictObject({ fieldKey: z.string(), assetId: z.uuid(), mimeType: z.string(),
      sizeBytes: z.number().int().nonnegative() })),
  })),
});
export type CapabilityDetail = z.infer<typeof CapabilityDetailSchema>;

/** M11 discovery consumes this public projection, never Worker configuration or SQL. */
export const CapabilityDiscoveryDocumentSchema=z.strictObject({
  capabilityId:z.uuid(),capabilityVersionId:z.uuid(),slug:z.string(),sellerId:z.uuid(),name:z.string(),
  description:z.string(),category:MarketplaceCategorySchema,tags:z.array(z.string()),
  ioContract:CapabilityIOContractSchema,
  permissionManifest:PublicPermissionManifestSchema,
  accepts:z.array(z.strictObject({key:z.string(),type:z.string(),required:z.boolean()})),
  outputs:z.array(z.strictObject({key:z.string(),type:z.string(),required:z.boolean()})),
  strengths:z.array(z.string()),limitations:z.array(z.string()),
  priceMinor:z.number().int().nonnegative(),currency:z.literal('USD'),
  rating:RatingSummarySchema,completedJobs:z.number().int().nonnegative(),
  typicalRuntimeSeconds:z.number().int().nonnegative().nullable(),
  availability:PublicAvailabilitySchema,
  exampleSummaries:z.array(z.strictObject({title:z.string(),description:z.string()})),
});
export type CapabilityDiscoveryDocument=z.infer<typeof CapabilityDiscoveryDocumentSchema>;
