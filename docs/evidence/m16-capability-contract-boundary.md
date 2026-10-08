# §8 published capability contract and hostile buyer text

`LocalCapabilityPackageSchema` and the immutable published-version snapshot
hold typed input/output fields, price and permission policy. The seller owns
the private instructions; buyer Web and REST create job input manifests only
through `validateInputPayload`, which rejects undeclared fields and invalid
types. Optional (`required:false`) fields remain optional in the same schema
used by seller authoring, buyer form, API and Worker instruction construction.

`buildJobInstructionEnvelope` keeps fixed instructions, seller-approved
instructions, declared contract data and buyer values in separate bounded
sections. Buyer values are serialized as data. The actual authority is the
versioned `WorkerBrokerRouter`, pinned sandbox, per-job lease, file/resource
brokers and provider budget. The installed paid E2E submits buyer-controlled
hostile text and attempts to change tools, schedule, network access and
seller resources. The Worker denies undeclared tool/host/network actions and
the Core seller policy revision is unchanged. The real Docker/OpenClaw
research fixture also contains hostile page instructions; they do not expand
the tool manifest. `tests/capability-io.test.mjs`,
`tests/job-instructions.test.mjs`, `tests/m16-installed-worker-e2e.mjs` and
`tests/docker-openclaw-selected-file-local-integration.mjs` are executable
evidence for the original §8 contract and defense-in-depth intent.

The optional-field regression uses the original Company Intelligence shape:
`companyName` is required while `website` and `researchQuestion` are optional.
It verifies omitted optional buyer fields are accepted and omitted required
fields fail at the same Core validator used by purchase. The installed paid
run then tests hostile buyer text against immutable seller policy and the
actual sandbox/Worker authorization boundary. This closes `PRD-0022`,
`PRD-0023`, and `PRD-0025`–`PRD-0030` for the behaviors stated in §8; it does
not claim that prompt text can make a generative model mathematically immune
to all hostile content.

For `IO-0087` (§211), the stopped-attempt collector rejects a manifest that
omits a required file. In the installed paid path the Worker validates all
declared fields/files, uploads them privately, Core finalizes the manifest
before `DELIVERED`, and the buyer retrieves both files in a fresh session.
The storage-failure injection produces `RESULT_REJECTED` with no settlement
or visible result manifest.

The companion `IO-0084`–`IO-0086` §211 rows are closed by the same installed
paid path plus the optional-output validator test. The seller-approved
published output contract supports the listed scalar, structured and file
types; a missing optional field remains valid, while required fields and
file contents must validate before delivery.

The §8 JSON example is illustrative. It is not a requirement to ship that
seller's private Company Intelligence capability. No claim is made that
prompt wording alone prevents injection.

The §231 validity/quality boundary is separately proven in the installed paid
job: output validation and private finalization permit a technically valid
result to settle once; the buyer can report a `QUALITY` problem afterward
without rewriting that technical verdict or financial journal. An injected
finalization failure produces `RESULT_REJECTED`, zero result manifests, zero
`SETTLE` journals and a released reservation. These checks close `TST-0019`;
they do not claim that Kivro can automatically determine subjective quality.
