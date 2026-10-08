#!/bin/sh
set -eu
# The default is a Core/Worker component slice. M16_INSTALLED_WORKER=1 also
# launches the host-native Worker and local HTTP Core with development credits.
# Neither mode claims a real Stripe test purchase.
docker build -f runtime/openclaw/Dockerfile -t kivro-openclaw-runtime:m07 runtime/openclaw
M16_REAL_OPENCLAW=1 sh tools/test-m13-postgres.sh
