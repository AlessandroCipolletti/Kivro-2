# M16 research restrictions and source limitations

Original source: Master Spec §265. This is an M06/M10 production correction
found during the M16 backlog convergence pass.

The shared `ResearchBroker` now requests each origin's `/robots.txt` through
the same DNS-vetted, pinned public transport before a public fetch or download,
including after redirects. It sends the `KivroResearch/1.0` user agent, gives
robots a 16 KiB response limit, charges the response against the job's network
budget and denies disallowed paths, access walls, redirects, invalid encoding,
unexpected content type and oversized responses. A 404/410 means the origin
has no robots file. Site 403/429 responses are never retried or bypassed.
The sandbox still has no direct public network route. The Cloud RPC now returns
only a structured policy/source code; the Worker bridge exposes only
`SOURCE_UNAVAILABLE` to OpenClaw for a blocked source and otherwise reports a
generic denial. No URL, credential, raw website body or seller path enters
that error channel.

The capability detail page warns buyers that site restrictions, rate limits
and authentication walls can make sources unavailable. It does not promise
unrestricted scraping.

Executed evidence:

- `node --test tests/research-broker.test.mjs`: robots allow/deny precedence,
  wildcard paths, cross-origin redirects, malformed/oversized files, site
  limits and no page fetch after a denial.
- `node --test tests/docker-broker-sidecar-local-integration.mjs`: actual
  offline Docker bridge returns a sanitized source limitation and cannot
  request the forbidden page or a private destination.
- `pnpm test:e2e:local` (2/2): authentic buyer detail disclosure and an
  approved public research fetch through the installed Worker, Cloud and
  OpenClaw; private result and ledger settlement still pass.
- `node --test tests/docker-openclaw-selected-file-local-integration.mjs`:
  real isolated OpenClaw requests a 403-blocked source, receives the bounded
  `SOURCE_UNAVAILABLE` limitation, requests an approved alternate public
  source, and submits a truthful answer. The blocked page is requested once;
  the alternative is requested once. Hostile script and instructions from the
  allowed source reach the model only as normalized untrusted plain text.

`PRD-0257` is now verified against its original behavior with a real
Docker/OpenClaw run. The whole §265 gate (`PRD-0253`) and its legal/terms
consideration (`PRD-0255`) remain `DEFERRED_VERIFICATION`: automated probes
cannot establish that a particular publisher's terms, copyright licenses,
data-use permissions and applicable jurisdictions have been independently
reviewed for a production deployment. Closure requires a documented legal
review of the concrete public research sources, regions and intended use;
the platform must keep denying access walls and never promise unrestricted
scraping in the meantime. A Stripe-funded blocked-source job is useful extra
acceptance evidence but is not substituted with the development-credit run.
