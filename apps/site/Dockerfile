# syntax=docker/dockerfile:1
# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /repo

# Copy manifests only — cache this layer until lockfile changes
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/site/package.json ./apps/site/
COPY packages/core/package.json ./packages/core/
COPY packages/react/package.json ./packages/react/
COPY packages/next/package.json ./packages/next/
COPY packages/charts/package.json ./packages/charts/
COPY packages/client/package.json ./packages/client/
COPY packages/adapter-drizzle/package.json ./packages/adapter-drizzle/
COPY packages/adapter-prisma/package.json ./packages/adapter-prisma/
COPY packages/adapter-bullmq/package.json ./packages/adapter-bullmq/

RUN pnpm install --frozen-lockfile

# ─── Stage 2: builder ─────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /repo

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/site/node_modules ./apps/site/node_modules

COPY . .

# Build workspace packages that the site depends on
RUN pnpm --filter @flowpanel/core build
RUN pnpm --filter @flowpanel/react build
RUN pnpm --filter @flowpanel/next build
RUN pnpm --filter @flowpanel/charts build
RUN pnpm --filter @flowpanel/client build

# Build the site
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @flowpanel/site build

# ─── Stage 3: runner ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Standalone output includes everything needed to run
COPY --from=builder /repo/apps/site/.next/standalone ./
COPY --from=builder /repo/apps/site/.next/static ./apps/site/.next/static
COPY --from=builder /repo/apps/site/public ./apps/site/public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/site/server.js"]
