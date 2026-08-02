#!/bin/sh
# Apply any pending Prisma migrations, then start the API.
# `migrate deploy` is safe to run concurrently across replicas (advisory lock)
# and is a no-op when the schema is up to date.
set -e

echo "Running prisma migrate deploy..."
pnpm exec prisma migrate deploy

exec node dist/index.js
