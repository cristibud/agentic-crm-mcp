# syntax=docker/dockerfile:1
# Build context MUST be the monorepo root: docker build -f packages/web/Dockerfile .

# ---------- base ----------
FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# ---------- deps ----------
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/api/package.json packages/api/
COPY packages/mcp-server/package.json packages/mcp-server/
COPY packages/web/package.json packages/web/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---------- build ----------
FROM deps AS build
# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so the
# public URLs of the api/mcp services MUST be passed here as build args.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_MCP_URL
ARG NEXT_PUBLIC_MCP_SERVER_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_MCP_URL=$NEXT_PUBLIC_MCP_URL
ENV NEXT_PUBLIC_MCP_SERVER_URL=$NEXT_PUBLIC_MCP_SERVER_URL

COPY packages/web packages/web
RUN pnpm --filter @crm/web build

# ---------- runner ----------
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app

# Next.js standalone output already bundles a minimal node_modules + server.js,
# laid out at /app/packages/web/server.js with shared deps under /app/node_modules.
COPY --from=build /app/packages/web/.next/standalone ./
COPY --from=build /app/packages/web/.next/static ./packages/web/.next/static

EXPOSE 3000
CMD ["node", "packages/web/server.js"]
