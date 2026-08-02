# ---------- Build stage ----------
FROM node:22-bookworm AS builder

WORKDIR /app

# Enable pnpm
RUN corepack enable

# Copy workspace files
COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./

# Copy packages + api
COPY packages ./packages
COPY apps/api ./apps/api

# Install deps (prod + build deps)
RUN pnpm install --frozen-lockfile

# Build workspace packages the API depends on (dist/ is excluded by .dockerignore,
# so each package's "exports" -> ./dist/index.js must be produced here or the API
# crashes at runtime with ERR_MODULE_NOT_FOUND)
RUN pnpm --filter @family/shared build
RUN pnpm --filter @family/agent-core build
RUN pnpm --filter @family/mcp-server build

# Build API (adjust if your build script name differs)
WORKDIR /app/apps/api
# Set NODE_ENV=production to prevent .env loading during prisma generate
# Prisma generate only needs schema, not actual DB connection
RUN NODE_ENV=production pnpm prisma generate
RUN pnpm build


# ---------- Runtime stage ----------
# Using Alpine for better compatibility with Azure Container Apps cgroups
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# Enable pnpm (corepack is included in node:22-alpine)
RUN corepack enable

# Copy only what we need
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/packages ./packages
COPY pnpm-workspace.yaml package.json ./

WORKDIR /app/apps/api

# Prisma needs this at runtime
ENV PRISMA_CLIENT_ENGINE_TYPE=binary

EXPOSE 3000

# Entrypoint runs prisma migrate deploy before starting the server, then execs
# node so SIGTERM still reaches the app directly
CMD ["sh", "docker-entrypoint.sh"]
