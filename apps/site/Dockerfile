# syntax=docker/dockerfile:1
# Production image for the FlowPanel marketing + docs site (apps/site).
# Builds straight from the monorepo source — no npm publish required — and
# ships the Next.js standalone output. Coolify: Base Directory "/",
# Dockerfile "apps/site/Dockerfile", port 3000.

# ─── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /repo

# Full workspace source. node_modules / .next / dist are excluded via the
# root .dockerignore, so the in-image install below is authoritative.
COPY . .

RUN pnpm install --frozen-lockfile

# Build the workspace packages the site imports, then the site itself.
# NEXT_PUBLIC_* values are inlined at build time; Coolify passes build-time
# env vars as build args.
ARG NEXT_PUBLIC_DEMO_URL
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_DEMO_URL=${NEXT_PUBLIC_DEMO_URL} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @flowpanel/core build \
 && pnpm --filter @flowpanel/react build \
 && pnpm --filter @flowpanel/next build \
 && pnpm --filter @flowpanel/charts build \
 && pnpm --filter @flowpanel/client build \
 && pnpm --filter @flowpanel/site build

# ─── Stage 2: runner ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Next standalone output bundles server.js + the traced workspace deps
# (next.config.ts sets output:"standalone" + outputFileTracingRoot:"../..").
COPY --from=builder /repo/apps/site/.next/standalone ./
COPY --from=builder /repo/apps/site/.next/static ./apps/site/.next/static
COPY --from=builder /repo/apps/site/public ./apps/site/public

USER nextjs

EXPOSE 3000
CMD ["node", "apps/site/server.js"]
