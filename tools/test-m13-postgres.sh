#!/bin/sh
set -eu
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_root=$(CDPATH= cd -- "$script_dir/.." && pwd)
container_name="kivro-m13-postgres-$$"
s3_container="kivro-m13-storage-$$"
s3_config=$(mktemp /tmp/kivro-m13-s3.XXXXXX)
chmod 600 "$s3_config"
printf '%s' '{"identities":[{"name":"kivrotest","credentials":[{"accessKey":"kivrotest","secretKey":"m13-local-temporary-password"}],"actions":["Admin","Read","Write","List","Tagging"]}]}' > "$s3_config"
cleanup() { docker rm -f "$container_name" "$s3_container" >/dev/null 2>&1 || true; rm -f "$s3_config"; }
trap cleanup EXIT HUP INT TERM
docker run --rm -d --name "$container_name" -p 127.0.0.1::5432 \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -v "$repo_root/packages/persistence/migrations:/migrations:ro" postgres:16-alpine >/dev/null
ready=0
for attempt in $(seq 1 40); do
  if docker exec "$container_name" pg_isready -U postgres >/dev/null 2>&1; then ready=1; break; fi
  sleep 0.25
done
if [ "$ready" -ne 1 ]; then printf 'PostgreSQL M13 container not ready\n' >&2; exit 1; fi
sleep 1
for migration in "$repo_root"/packages/persistence/migrations/00[0-9][0-9]_*.sql; do
  docker exec "$container_name" psql -v ON_ERROR_STOP=1 -U postgres \
    -f "/migrations/$(basename -- "$migration")" >/dev/null
done
mapped_port=$(docker port "$container_name" 5432/tcp | sed -n 's/.*://p' | head -1)
docker run --rm -d --name "$s3_container" -p 127.0.0.1::8333 \
  --mount "type=bind,source=$s3_config,target=/etc/seaweedfs/s3.json,readonly" \
  chrislusf/seaweedfs@sha256:4e61d15fd35994cb1e43e1e553dff106794841fd9a99ade2fc8c8bfce4d7872d \
  server -dir=/data -s3 -s3.config=/etc/seaweedfs/s3.json -volume.max=0 \
  -master.volumeSizeLimitMB=100 >/dev/null
s3_port=$(docker port "$s3_container" 8333/tcp | sed -n 's/.*://p' | head -1)
export OBJECT_STORAGE_ENDPOINT="http://127.0.0.1:$s3_port"
export OBJECT_STORAGE_BUCKET="kivro-m13-test"
export OBJECT_STORAGE_REGION="us-east-1"
export OBJECT_STORAGE_ACCESS_KEY_ID="kivrotest"
export OBJECT_STORAGE_SECRET_ACCESS_KEY="m13-local-temporary-password"
ready=0
for attempt in $(seq 1 60); do
  if curl -sS -o /dev/null "$OBJECT_STORAGE_ENDPOINT" >/dev/null 2>&1; then ready=1; break; fi
  sleep 0.25
done
if [ "$ready" -ne 1 ]; then echo 'SeaweedFS M13 storage not ready' >&2; exit 1; fi
node --input-type=module -e 'import {S3Client,CreateBucketCommand} from "@aws-sdk/client-s3";
const client=new S3Client({region:process.env.OBJECT_STORAGE_REGION,
  endpoint:process.env.OBJECT_STORAGE_ENDPOINT,forcePathStyle:true,
  credentials:{accessKeyId:process.env.OBJECT_STORAGE_ACCESS_KEY_ID,
  secretAccessKey:process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY}});
await client.send(new CreateBucketCommand({Bucket:process.env.OBJECT_STORAGE_BUCKET}));client.destroy();'
M13_DATABASE_URL="postgres://postgres@127.0.0.1:$mapped_port/postgres" \
  node --test "$repo_root/tests/m13-postgres-integration.mjs"
