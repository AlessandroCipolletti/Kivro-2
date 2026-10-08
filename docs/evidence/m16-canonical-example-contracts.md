# Original §§199 and 260 example contracts

These sections give representative capability contracts; Kivro does not ship
the seller's Blender renderer or private advertising model as platform code.
Both examples now have concrete deterministic fixtures exercised through
the shared contract and real product boundaries.

## §199 Blender

`tests/fixtures/m16-blender-contract.json` is the exact versioned contract:
required long instructions, required `.blend` scene bounded to 500 MB,
optional JPEG/PNG/WebP references bounded to ten, a 1080p/1440p/4K select,
one to ten JPEG/PNG outputs and optional modified `.blend`. Unit tests parse
it through `CapabilityIOContractSchema`, accept and reject exact input/select
and output cardinality values. The Marketplace Agent ranks the exact public
contract using file formats, and the orchestration planner rejects a mapping
from the renderer's 100 MB image output into its 10 MB reference input.
`tests/browser-m10/media-examples.spec.ts` publishes a version fixture and
renders every field, extension and size in the actual buyer capability page
at desktop/mobile widths. That page and `/v1/capabilities/:id` both consume
the same `MarketplaceCatalog.detailByIdentifier` Core projection; API job
creation and Worker staging use the same versioned input schema and output
validation code exercised by `tests/capability-io.test.mjs` and the installed
paid Worker E2E. The fixture tests contract interoperability, not a seller's
Blender installation or a completed render.

## §260 advertising

`tests/fixtures/m06-advertising-capability.json` is the canonical
companyName/optional website/product/assets/audience contract, public
research policy, and MP4/strategy/sources output contract. The companion
private `seller-video-ad` skill and deterministic 60-second MP4 fixture are
in `tests/fixtures/m16-video-ad/`.
`tests/docker-openclaw-advertising-local-integration.mjs` stages only the
hash-pinned reviewed skill with production `prepareOpenClawJobInput`; pinned
Docker/OpenClaw makes two bounded public searches and fetches company and
competitor pages, sees normalized text without page script instructions,
writes the MP4 through its bounded output tool and submits a Markdown
strategy and two structured sources. The production output collector
validates MP4 MIME and byte size. The fixture checks the MP4 container's
duration metadata is exactly 60 seconds. Browser M10 publishes the example
version into its disposable marketplace fixture and renders the exact I/O,
public research declaration and source limitation at desktop/mobile widths.
The generic authenticated seller publication and paid result/storage/ledger
pipeline are separately exercised in `tests/m16-installed-worker-e2e.mjs`.

These fixtures prove Kivro can carry the examples through its generic
versioned contracts and actual OpenClaw/research/output boundaries. The
advertising test uses a deterministic media fixture, not a commercial video
generation model, and does not claim a single Stripe-funded advertising job.
