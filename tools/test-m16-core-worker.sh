#!/bin/sh
set -eu
# This is a real Core/Worker/Docker/OpenClaw/storage component slice. SQL fixture
# publication, synthetic inference and test credits do not satisfy release E2E.
docker build -f runtime/openclaw/Dockerfile -t kivro-openclaw-runtime:m07 runtime/openclaw
M16_REAL_OPENCLAW=1 sh tools/test-m13-postgres.sh
