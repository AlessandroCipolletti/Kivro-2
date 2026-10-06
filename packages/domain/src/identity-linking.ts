import { z } from 'zod';

const EmailSchema = z.email().max(320);

/** Preserve dots and plus aliases; provider-specific rewriting can merge unrelated inboxes. */
export function normalizeEmail(email: string): string {
  return EmailSchema.parse(email.trim().toLowerCase());
}

export interface GoogleIdentityClaim {
  readonly subject: string;
  readonly email: string;
  readonly emailVerified: boolean;
}

export interface ExistingIdentityMatch {
  readonly providerSubjectAccountId: string | null;
  readonly normalizedEmailAccountId: string | null;
  readonly normalizedEmailVerified: boolean;
}

export type GoogleAccountResolution =
  | { readonly action: 'USE_LINKED_ACCOUNT'; readonly accountId: string }
  | { readonly action: 'LINK_TO_VERIFIED_ACCOUNT'; readonly accountId: string; readonly normalizedEmail: string }
  | { readonly action: 'CREATE_VERIFIED_ACCOUNT'; readonly normalizedEmail: string }
  | { readonly action: 'REQUIRE_EXPLICIT_VERIFICATION'; readonly normalizedEmail: string }
  | { readonly action: 'REJECT_UNVERIFIED_CLAIM' };

/**
 * Deterministic linking policy. Caller must validate the signed Google OIDC token,
 * issuer, audience, nonce and state before passing this claim. A DB transaction
 * with unique provider subject and normalized email constraints owns the commit.
 */
export function resolveGoogleAccount(claim: GoogleIdentityClaim, existing: ExistingIdentityMatch): GoogleAccountResolution {
  if (claim.subject.length === 0 || claim.subject.length > 255) throw new TypeError('Invalid Google subject');
  const normalizedEmail = normalizeEmail(claim.email);
  if (!claim.emailVerified) return { action: 'REJECT_UNVERIFIED_CLAIM' };
  if (existing.providerSubjectAccountId !== null) {
    if (existing.normalizedEmailAccountId !== null &&
      existing.providerSubjectAccountId !== existing.normalizedEmailAccountId) {
      throw new TypeError('Google subject and email resolve to different accounts');
    }
    return { action: 'USE_LINKED_ACCOUNT', accountId: existing.providerSubjectAccountId };
  }
  if (existing.normalizedEmailAccountId !== null) {
    if (!existing.normalizedEmailVerified) {
      return { action: 'REQUIRE_EXPLICIT_VERIFICATION', normalizedEmail };
    }
    return { action: 'LINK_TO_VERIFIED_ACCOUNT', accountId: existing.normalizedEmailAccountId, normalizedEmail };
  }
  return { action: 'CREATE_VERIFIED_ACCOUNT', normalizedEmail };
}
