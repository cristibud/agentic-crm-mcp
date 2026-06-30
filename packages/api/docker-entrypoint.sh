#!/bin/sh
set -e

echo "[entrypoint] Applying database migrations (prisma migrate deploy)..."
# Call the Prisma CLI directly (no pnpm/corepack at runtime — avoids pulling an
# incompatible pnpm version). WORKDIR is /app/packages/api.
node_modules/.bin/prisma migrate deploy

# Seed the database ONLY when it is empty (no users yet). This creates the admin
# user whose apiKey must match the API_KEY the web/mcp send. The guard keeps it
# idempotent — restarts won't duplicate the demo data.
echo "[entrypoint] Checking whether the database needs seeding..."
USERS=$(node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.user.count().then(n=>{console.log(n);return p.\$disconnect()}).catch(()=>{console.log('-1')})")
if [ "$USERS" = "0" ]; then
  echo "[entrypoint] Empty database — running seed..."
  node_modules/.bin/tsx prisma/seed.ts
else
  echo "[entrypoint] Database already has $USERS user(s) — skipping seed."
fi

echo "[entrypoint] Starting API server..."
exec "$@"
