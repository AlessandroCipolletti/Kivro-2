import type { Account, SellerProfile } from '../../contracts/src/account.js';

/** Account-level gates only. Funding, Worker, security and capability checks occur elsewhere. */
export function accountCapabilities(account: Account, sellerProfile?: SellerProfile): {
  canUseAccount: boolean;
  canEnterPaidBuyerFlow: boolean;
  canConfigureSelling: boolean;
  meetsSellerAccountPrerequisites: boolean;
} {
  const active = account.status === 'ACTIVE';
  const verified = account.emailVerifiedAt !== null;
  const terms = account.termsAcceptedAt !== null;
  const sameAccount = sellerProfile?.accountId === account.id;
  return {
    canUseAccount: active,
    canEnterPaidBuyerFlow: active && verified && terms,
    canConfigureSelling: active && verified && sameAccount,
    meetsSellerAccountPrerequisites: active && verified && terms && sameAccount &&
      sellerProfile?.status === 'ACTIVE' && sellerProfile.payoutStatus === 'READY',
  };
}
