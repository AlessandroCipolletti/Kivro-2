# M16 accessibility audit (§539)

Automated WCAG 2 A/AA and 2.1 A/AA checks use `@axe-core/playwright` on
rendered pages. The public browser suite covers home, sign-in, Discover and a
real capability detail at 1280 px and 390 px. Authenticated browser suites
cover the buyer quote with a field error, a reserved and a cancelled job at
390 px; seller onboarding and the operations dashboard at desktop/mobile;
and buyer API/webhook settings at desktop/mobile. The installed development-
credit Docker/OpenClaw E2E additionally audits the authentic seller publication,
buyer quote, BUSY capability, queued/running paid jobs, completed paid result
and failed paid result. It reopens the same
buyer's durable job history after Worker failure and checks mobile overflow.

These executed audits found low-contrast labels, empty-state copy, result-file
metadata and seller operations history. Production color tokens/selectors were
corrected; the final installed E2E audit passes with zero axe violations on
the states it visits. The earlier sign-in test exposed that an SSR-enabled
submit could be clicked before hydration and lose the action. The form now
disables its interactive controls until React is ready. Existing browser
tests and the installed seller/buyer path pass with that correction.

The M14 browser suite also checks mobile navigation by keyboard, visible focus,
unlabeled fields, long-content overflow and reduced motion. The buyer quote
test checks `aria-invalid` and an error node associated through
`aria-describedby`. The installed result asserts private download and
historical favorite mobile touch targets and accessible links. The M12 seller
browser passes axe in cloud-side paused and critical security warning states
at desktop/mobile; the warning is an accessible `role="alert"` with severity,
blocking state, affected Worker and required action. The M13 account browser
passes axe with a rejected webhook URL and a visible alert. All three browser
suites and the installed E2E passed on this tree. The queued paid job and BUSY
capability pass axe at 1280 px and 390 px; the queued cancellation target is at
least 44 px. Together with keyboard focus, semantic roles, visible status
text, associated form errors, contrast, reduced motion and overflow assertions,
this closes the original §539 minimum expectations for `UI-0077`. This is
automated rendered evidence, not a manual assistive-technology certification.

Reproduce with `pnpm test:browser:m10`, `pnpm test:browser:m12`,
`pnpm test:browser:m13`, and `pnpm test:e2e:local` with the live local ClamAV
socket. The installed E2E passed 2/2 on 2026-10-08 with the queued/BUSY
assertions.
