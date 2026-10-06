# M02 local auth browser review — 2026-10-06

Environment: Next 16.3.8 web app at `http://localhost:3001`, local PostgreSQL 16 and Mailpit, with a matching `APP_ORIGIN`. Port 3000 was occupied by another local project. The app was built with `pnpm --filter @kivro/web build` and exercised in the in-app browser.

- A verified synthetic test account signed in through the rendered email/password form and reached `/account`; the account page displayed the same canonical account and verified status.
- Sign out returned to `/sign-in`; an unauthenticated visit to `/account` redirected to `/sign-in`.
- Recovery submission for a synthetic unknown address displayed the generic “If this address has an account” response.
- Landing, sign-in, create-account, recovery, and account pages were visually inspected at the default desktop viewport. Sign-in and create-account were also inspected at 390×844; the form was moved above introductory copy after the first mobile review.

The manual visual review is complemented by `pnpm test:auth:browser`, an automated Chrome flow through real Next, PostgreSQL and Mailpit. It covers registration, resend, verification, one-use verification link, login, sign-out, protected-route redirect, reset, one-use reset link and rejected old password. `tests/auth-local-integration.mjs` additionally covers expired/cross-purpose links, resend rate limiting, enumeration responses and explicit password setup on a seeded Google-origin identity. Real Google callback, live duplicate-account linking and the full Google/failure-state browser matrix remain open.
