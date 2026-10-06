import { PriceSnapshotSchema, type PriceSnapshot } from '../../contracts/src/pricing.js';

export function validateSelectedTier(snapshot: PriceSnapshot, enabled: boolean): PriceSnapshot {
  if (!enabled) throw new TypeError('Price tier is disabled');
  const value = PriceSnapshotSchema.parse(snapshot);
  if (value.currency !== 'USD') throw new TypeError('Unsupported currency');
  return Object.freeze(value);
}
