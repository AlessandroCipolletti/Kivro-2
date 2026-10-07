#!/bin/sh
set -eu
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_root=$(CDPATH= cd -- "$script_dir/.." && pwd)
container_name="kivro-m12-browser-postgres-$$"
mail_name="kivro-m12-browser-mail-$$"
cleanup() { docker rm -f "$container_name" "$mail_name" >/dev/null 2>&1 || true; }
trap cleanup EXIT HUP INT TERM
docker run --rm -d --name "$container_name" -p 127.0.0.1::5432 \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -v "$repo_root/packages/persistence/migrations:/migrations:ro" postgres:16-alpine >/dev/null
docker run --rm -d --name "$mail_name" -p 127.0.0.1::1025 \
  -p 127.0.0.1::8025 axllent/mailpit:v1.31.4 >/dev/null
export M12_MAIL_SMTP_PORT=$(docker port "$mail_name" 1025/tcp | sed -n 's/.*://p' | head -1)
export M12_MAIL_API_PORT=$(docker port "$mail_name" 8025/tcp | sed -n 's/.*://p' | head -1)
ready=0
for attempt in $(seq 1 40); do
  if docker exec "$container_name" pg_isready -U postgres >/dev/null 2>&1 && \
    curl -fsS "http://127.0.0.1:$M12_MAIL_API_PORT/api/v1/messages" >/dev/null 2>&1; then ready=1; break; fi
  sleep 0.25
done
if [ "$ready" -ne 1 ]; then echo 'M12 browser infrastructure not ready' >&2; exit 1; fi
sleep 1
for migration in "$repo_root"/packages/persistence/migrations/00[0-9][0-9]_*.sql; do
  docker exec "$container_name" psql -v ON_ERROR_STOP=1 -U postgres \
    -f "/migrations/$(basename -- "$migration")" >/dev/null
done
mapped_port=$(docker port "$container_name" 5432/tcp | sed -n 's/.*://p' | head -1)
export M12_DATABASE_URL="postgres://postgres@127.0.0.1:$mapped_port/postgres"
pnpm exec playwright test -c playwright.m12.config.mts
