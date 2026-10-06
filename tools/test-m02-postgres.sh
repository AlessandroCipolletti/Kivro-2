#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_root=$(CDPATH= cd -- "$script_dir/.." && pwd)
container_name="kivro-m02-postgres-$$"
cleanup() { docker rm -f "$container_name" >/dev/null 2>&1 || true; }
trap cleanup EXIT HUP INT TERM

docker run --rm -d --network none --name "$container_name" \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -v "$repo_root/packages/persistence/migrations:/migrations:ro" \
  postgres:16-alpine >/dev/null

ready=0
for attempt in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40; do
  if docker exec "$container_name" pg_isready -U postgres >/dev/null 2>&1; then ready=1; break; fi
  sleep 0.25
done
if [ "$ready" -ne 1 ]; then
  printf 'PostgreSQL test container did not become ready\n' >&2
  exit 1
fi

# The official image starts a temporary bootstrap server, then restarts it.
sleep 1
ready=0
for attempt in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  if docker exec "$container_name" pg_isready -U postgres >/dev/null 2>&1; then ready=1; break; fi
  sleep 0.25
done
if [ "$ready" -ne 1 ]; then
  printf 'PostgreSQL test container did not remain ready\n' >&2
  exit 1
fi

docker exec "$container_name" psql -v ON_ERROR_STOP=1 -U postgres -f /migrations/0001_foundation.sql >/dev/null
docker exec "$container_name" psql -v ON_ERROR_STOP=1 -U postgres -f /migrations/0002_auth.sql >/dev/null
docker exec "$container_name" psql -v ON_ERROR_STOP=1 -U postgres -f /migrations/0003_auth_schema_compat.sql >/dev/null
docker exec "$container_name" psql -v ON_ERROR_STOP=1 -U postgres -f /migrations/0004_auth_rate_limit_id.sql >/dev/null
docker exec "$container_name" psql -v ON_ERROR_STOP=1 -U postgres -f /migrations/0005_auth_uuid_defaults.sql >/dev/null
docker exec "$container_name" psql -v ON_ERROR_STOP=1 -U postgres -f /migrations/0006_auth_verification_one_use.sql >/dev/null
docker exec "$container_name" psql -v ON_ERROR_STOP=1 -U postgres -f /migrations/0007_auth_audit.sql >/dev/null
docker exec -i "$container_name" psql -v ON_ERROR_STOP=1 -U postgres -f - < "$repo_root/tests/sql/m02_auth.sql"
