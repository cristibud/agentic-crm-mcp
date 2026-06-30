# syntax=docker/dockerfile:1
# Build context MUST be the monorepo root: docker build -f packages/mcp-server/Dockerfile .

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
COPY packages/mcp-server packages/mcp-server
RUN pnpm --filter mcp-server build

# ---------- runner ----------
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

# Root node_modules carries `openai` (a hoisted root dependency that the
# mcp-server resolves via the workspace).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/mcp-server/node_modules ./packages/mcp-server/node_modules
COPY --from=build /app/packages/mcp-server/dist ./packages/mcp-server/dist
COPY --from=build /app/packages/mcp-server/package.json ./packages/mcp-server/package.json

WORKDIR /app/packages/mcp-server
EXPOSE 3002
CMD ["node", "dist/index.js"]
