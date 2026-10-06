# Persistence

One logical PostgreSQL schema and migration history for both profiles. Migrations `0001`–`0007` establish the foundation and M02 auth tables. M03 migrations `0008`–`0009` add capability visibility/version lifecycle/private grants and a versioned append-only seller execution-model acknowledgement. `tools/run-local-migrations.mjs` applies each migration atomically with a session advisory lock and records it in `schema_migrations`. The same migration history must run in both deployment profiles.
