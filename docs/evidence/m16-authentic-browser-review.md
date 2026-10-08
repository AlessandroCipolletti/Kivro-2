# M16 authentic seller and buyer browser review

Source checked: Master Spec §§227, 532, 539 and 550. The browser fixture in
`tests/m16-installed-worker-e2e.mjs` uses an actual Worker-generated review,
the authenticated seller publication handler, a distinct authenticated buyer,
the published Core permission manifest, a private browser upload and a paid
development-credit job through Docker/OpenClaw. It does not substitute for
Stripe test acceptance or deployed-provider conformance.

## Executed assertions

- The seller keyboard-opens the exact version's contract/permission disclosure.
  Every category and state in that disclosure equals the Worker review's
  immutable public manifest before publication. The seller explicitly approves
  each required local permission and the complete version.
- The buyer keyboard-opens the published capability disclosure. Every category
  and state equals the same review manifest after publication. The buyer sees
  where input is processed, retention and external-processor declarations, and
  an explicit statement that this is not confidential computing.
- Before Web upload, the input form shows a stronger sensitive-information
  warning. The buyer uploads `source.txt`, receives a private finalized asset
  and a server-authored quote; the paid REST purchase uses that exact asset ID.
- The authenticated buyer result shows the persisted completed/settled state,
  two finalized private files and downloadable bytes. The mobile pages assert
  390 px document width without horizontal overflow.
- A separate real Docker/OpenClaw review invokes the declared read-only
  database broker against a dedicated PostgreSQL role. The role cannot read a
  private table or write the public one. Its Worker-generated review is
  seller-approved and published through the authenticated Web form. Both the
  seller review and public buyer page show `Seller database — Read only` from
  that exact manifest; the document capability without it shows `Not used`.
- The paid remote-model version publicly declares `synthetic` as its external
  processor before the Worker invokes that model route. The later local-model
  version publicly declares no external processors. These are local fixtures,
  not proof of a production third-party processor or Stripe transaction.

## Rendered review

At 1280 × 900 and 390 × 844, the seller contract, permission list, buyer
privacy disclosure, sensitive-input warning, quote and result retained readable
type, clear headings and non-color-only states. The permission copy now uses
the same plain-language category/state labels on both sides. The warning is
visible before the input fields and explicitly names seller-machine processing
and the absence of confidential computing. The quote displays the current
price, available credits, eligibility window and reservation effect without
inventing a completion ETA. The result displays durable deliverables and
history without inferring a progress percentage. Inspection found no clipped
content or horizontal overflow at 390 px.

Evidence images in this directory:

- `m16-seller-publish-desktop.png`, `m16-seller-publish-mobile.png`,
  `m16-seller-permissions-desktop.png`, `m16-seller-permissions-mobile.png`,
  `m16-seller-consent-mobile.png`;
- `m16-buyer-privacy-desktop.png`, `m16-buyer-privacy-mobile.png`,
  `m16-buyer-sensitive-warning-desktop.png`,
  `m16-buyer-sensitive-warning-mobile.png`,
  `m16-buyer-upload-quote-desktop.png`;
- `m16-buyer-result-desktop.png`, `m16-buyer-result-mobile.png`.
- `m16-public-database-desktop.png`, `m16-public-database-mobile.png`,
  `m16-public-remote-processor-desktop.png`,
  `m16-public-remote-processor-mobile.png`.
- `m16-seller-remote-publish-desktop.png`,
  `m16-seller-remote-publish-mobile.png`,
  `m16-seller-remote-permissions-desktop.png`,
  `m16-seller-remote-permissions-mobile.png`,
  `m16-seller-remote-consent-mobile.png`.
- `m16-seller-database-publish-desktop.png`,
  `m16-seller-database-publish-mobile.png`,
  `m16-seller-database-permissions-desktop.png`,
  `m16-seller-database-permissions-mobile.png`,
  `m16-seller-database-consent-mobile.png`.
- `m16-seller-private-grant-desktop.png`,
  `m16-seller-private-grant-mobile.png`.

This closes the §227 warning requirements and the individual plain-language
security/UI design checks whose original wording these screens prove. The
authentic read-only database publication and absent-permission comparison also
close the §532 security-UI gates. The complete §539
accessibility audit also remains open; keyboard disclosure and field-label
checks are component evidence, not a full accessibility assessment. The
whole-product §550 gate needs the remaining real availability, failure and
remote-payment states reviewed together.

The remote v2 review names the same `synthetic` provider that the paid
Docker/OpenClaw broker calls. The local v3 seller review requires a new Web
approval and names no external processor; its separate paid Worker route uses
the local model. PostgreSQL retains both immutable version snapshots, so a
change in processing does not rewrite the v2 privacy statement. Generated
model responses are deterministic test data: this proves declaration and
route consistency, not a live third-party LLM contract.
