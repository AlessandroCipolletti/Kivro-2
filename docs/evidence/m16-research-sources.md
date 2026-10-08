# Research source lists — component evidence for Master Spec §259

`packages/contracts/src/contract-values.ts` now accepts an optional output
field with `type: JSON` and `semanticType: RESEARCH_SOURCES`. When a capability
declares that semantic type, output validation requires a bounded list of
credential-free HTTP(S) source URLs, optional bounded titles and ISO access
timestamps. Invalid source objects fail output validation; the same capability
can omit its optional sources field. `tests/capability-io.test.mjs` passes all
valid, omitted and adversarial cases. The generic JSON result renderer shows
the structured values as escaped text rather than executing HTML or opening
the seller's personal browser.

The current-tree `pnpm test:e2e:local` also passed 2/2. An authenticated seller
published a version whose optional `sources` field is in the immutable
contract. A distinct buyer paid with development credits. The installed
Worker called the Cloud Research Broker, then ran pinned Docker/OpenClaw,
submitted the standard source object and two private output files. The test
read the finalized PostgreSQL result payload and reopened the buyer result in
a fresh authenticated browser. The buyer saw the URL and access time as
escaped, non-executable text. A prior published version without a sources
field remains valid. This closes `PRD-0240` for the original optional-source
behavior. Stripe-funded final release acceptance remains separate.
