# M16 §475 schedule quote expiry and revalidation

The authoritative `PostgresAvailabilityRepository.book` validates the
immutable two-minute quote, current published version and price, seller and
Worker schedule revisions, pauses, Worker health, capacity and buyer payment
limits before it atomically reserves credits. The buyer Web form displays the
expiry and requires a new preflight after `STALE_QUOTE`.

Executed evidence:

- `pnpm test:postgres:m09`: a quote expired through the repository clock is
  rejected with no reservation; schedule pause, capacity, Worker-offline and
  queue changes are revalidated before booking.
- `pnpm test:postgres:m10`: publishing a differently priced version after
  preflight rejects the old quote with `STALE_QUOTE` and no reservation; a
  fresh quote uses the new immutable price.
- `pnpm test:browser:m10`: the seller schedule changes after the buyer sees a
  future quote. Confirmation displays a stale-terms error and creates no
  reservation; the buyer must request and confirm a fresh quote.

These tests establish the §475 buyer-confirmation and payment boundary on the
current local Core. They do not claim Stripe funding or deployed-profile
acceptance, which remain separately open.
