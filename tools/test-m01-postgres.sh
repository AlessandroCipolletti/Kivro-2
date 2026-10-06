#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_root=$(CDPATH= cd -- "$script_dir/.." && pwd)
container_name="kivro-m01-postgres-$$"
cleanup() { docker rm -f "$container_name" >/dev/null 2>&1 || true; }
trap cleanup EXIT HUP INT TERM

docker run --rm -d --network none --name "$container_name" \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -v "$repo_root/packages/persistence/migrations/0001_foundation.sql:/migration.sql:ro" \
  postgres:16-alpine >/dev/null

ready=0
for attempt in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  if docker exec "$container_name" pg_isready -U postgres >/dev/null 2>&1; then ready=1; break; fi
  sleep 0.25
done
if [ "$ready" -ne 1 ]; then
  printf 'PostgreSQL test container did not become ready\n' >&2
  exit 1
fi

docker exec "$container_name" psql -v ON_ERROR_STOP=1 -U postgres -f /migration.sql >/dev/null
docker exec -i "$container_name" psql -v ON_ERROR_STOP=1 -U postgres -f - < "$repo_root/tests/sql/m01_foundation.sql"
