# ---------- Build stage ----------
FROM node:20-bookworm AS builder

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

# Build shared package first (API depends on it)
RUN pnpm --filter @family/shared build

# Build API (adjust if your build script name differs)
WORKDIR /app/apps/api
RUN pnpm prisma generate
RUN pnpm build


# ---------- Runtime stage ----------
FROM node:20-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

# Enable pnpm
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

CMD ["node", "dist/index.js"]
