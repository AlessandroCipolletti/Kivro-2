#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_root=$(CDPATH= cd -- "$script_dir/.." && pwd)
container_name="kivro-m06-postgres-$$"
cleanup() { docker rm -f "$container_name" >/dev/null 2>&1 || true; }
trap cleanup EXIT HUP INT TERM

docker run --rm -d --name "$container_name" -p 127.0.0.1::5432 \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -v "$repo_root/packages/persistence/migrations:/migrations:ro" postgres:16-alpine >/dev/null
ready=0
for attempt in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40; do
  if docker exec "$container_name" pg_isready -U postgres >/dev/null 2>&1; then ready=1; break; fi
  sleep 0.25
done
if [ "$ready" -ne 1 ]; then printf 'PostgreSQL M06 test container not ready\n' >&2; exit 1; fi
sleep 1
for migration in "$repo_root"/packages/persistence/migrations/00[0-9][0-9]_*.sql; do
  docker exec "$container_name" psql -v ON_ERROR_STOP=1 -U postgres \
    -f "/migrations/$(basename -- "$migration")" >/dev/null
done
mapped_port=$(docker port "$container_name" 5432/tcp | sed -n 's/.*://p' | head -1)
if [ -z "$mapped_port" ]; then printf 'PostgreSQL mapped port unavailable\n' >&2; exit 1; fi
M06_DATABASE_URL="postgres://postgres@127.0.0.1:$mapped_port/postgres" \
  M06_READONLY_URL="postgres://seller_readonly@127.0.0.1:$mapped_port/postgres" \
  node --test "$repo_root/tests/m06-postgres-integration.mjs"
