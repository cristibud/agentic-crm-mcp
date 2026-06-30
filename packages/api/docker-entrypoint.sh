#!/bin/sh
set -e

echo "[entrypoint] Applying database migrations (prisma migrate deploy)..."
# Call the Prisma CLI directly (no pnpm/corepack at runtime — avoids pulling an
# incompatible pnpm version). WORKDIR is /app/packages/api.
node_modules/.bin/prisma migrate deploy

echo "[entrypoint] Starting API server..."
exec "$@"
