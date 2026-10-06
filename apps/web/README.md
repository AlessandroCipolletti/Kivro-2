# Buyer and seller web app

The M02 authentication route and its PostgreSQL adapter are implemented under `src/auth/` and `app/api/auth/`. Email registration, verification, login, reset and logout pass backend and automated Chrome browser tests using local PostgreSQL and Mailpit. Sign-in, account creation, verification guidance, recovery, and account screens are present. A manual local browser review confirmed desktop and mobile layouts. Real Google callback, account deduplication/linking and the complete failure-state E2E matrix remain open.

The auth audit records account, identity, password, and session changes transactionally in PostgreSQL, plus route/status outcomes for sensitive HTTP flows. Its table has no credential, email, IP, token, or URL fields. Audit insert failure suppresses a newly issued auth response. Audit retention and broader attack/failure testing remain open.

M03 adds the protected `/seller` entry and `/api/seller/profile`. A verified active canonical account can create one draft seller profile after explicitly confirming the local-execution and seller-cost statement. The acknowledgement is versioned and append-only in PostgreSQL; it does not grant capability permissions. The seller page does not claim Worker pairing, readiness or publication. The full import wizard and consent/publish APIs remain open.

Better Auth's user ID is the canonical Kivro `accounts.id`; provider accounts live in `account_identities`. Never add a second auth user table. Production requires explicit auth secrets, an encrypted email outbox key, Google identity credentials, and HTTPS. There is no development bypass for verification or paid actions.
