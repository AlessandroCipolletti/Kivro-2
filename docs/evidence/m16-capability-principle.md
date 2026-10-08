# M16 original §§119 and 259 capability review

The §119 product principle describes a complete executable capability, not a
standalone skill upload. The authenticated seller Web review in
`tests/m16-installed-worker-e2e.mjs` binds the exact reviewed Worker package,
selected skill and selected private file, research policy, local inference,
input/output contract, price, provider-cost estimate and buyer-visible public
permissions to one immutable published version. The installed Worker reopens
the version-pinned package after restart; admission checks exact hashes and
current health before the paid job. The real Docker/OpenClaw execution reaches
only the approved research and local file brokers, stores two private result
assets and settles one ledger journal. The buyer detail page describes one
execution of the published capability, its exact inputs, outputs, price,
availability and access, and states that this does not grant access to the
seller's computer. The test checks the published permission manifest and
buyer disclosure against the version actually executed.

The current-tree `pnpm test:e2e:local` run passed 2/2 on 2026-10-07 after
the buyer copy and optional-source assertions were added.

This is development-credit local E2E, not Stripe/provider acceptance. It is
sufficient for the distinct §119 capability-composition criterion; the
Stripe-backed release gates remain open.

Original §259 explicitly makes a `sources` output optional. The paid document
capability in the same E2E has no `sources` field, still passes output
validation and delivers its files to the authorized buyer. This closes only
the individual “do not require every capability to expose sources” criterion
(`PRD-0241`). The full research-provenance feature (`PRD-0240`) still needs an
actual source-list contract, validation and buyer inspection path.
