# M16 conditional inputs and safe scalar defaults

The original §§202 and 209 require one normalized versioned contract to
express simple `field A == value` conditions and seller-defined safe scalar
defaults. The seller's private visual editor now exposes a typed prior-field
condition, a value control matched to that field, scalar defaults, and an
interactive buyer-form preview. Drafts persist with owner and revision checks;
saving a draft does not grant Worker access or publish it.

The buyer form renders the conditional field only while the published
condition is true. It also excludes an asset previously selected for a field
that later becomes hidden. `validateInputPayload` remains the server authority:
it requires a visible required field, rejects a hidden field supplied directly
by an API client, and applies the published scalar default before evaluating a
condition. `buildJobInstructionEnvelope` reruns that same validator before the
Worker stages files and constructs OpenClaw instructions. File fields and
permissions cannot carry defaults in the contract schema.

Executable evidence:

- `tests/browser-m12/seller-operations.spec.ts` saves and reloads a private
  conditional draft, confirms the scalar default, and toggles its live buyer
  preview.
- `tests/browser-m10/media-examples.spec.ts` renders a published conditional
  video field in the authenticated buyer form at desktop/mobile widths, and
  checks the published Blender resolution default.
- `tests/capability-io.test.mjs` rejects hidden or missing fields and file
  defaults; `tests/job-instructions.test.mjs` repeats conditional and default
  checks at the Worker envelope boundary.
- `tests/m16-input-contract-postgres-integration.mjs` proves private draft
  persistence, owner isolation, revision races and use of the buyer Core
  validator.

The original condition language remains intentionally limited to one prior
field equality. This evidence does not imply arbitrary expression support.

For §203, the persisted draft, signed Worker package and immutable published
version all use `InputContractSchema` / `CapabilityIOContractSchema` as a
product-specific normalized representation. The buyer form, Core validator
and Worker envelope consume that published representation. JSON Schema
generation is optional in the original text and is not claimed.
