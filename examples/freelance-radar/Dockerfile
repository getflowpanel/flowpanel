# Multi-stage production build for the freelance-radar public demo.
#
# Assumes `flowpanel@1.0.0` (and adapter packages) are published to npm.
# The shipped package.json uses `workspace:*` so the demo can develop
# alongside the monorepo. The `prep` stage rewrites those to caret pins
# before install, which keeps this Dockerfile usable as a standalone copy.
#
# Build from this directory:
#   docker build -t freelance-radar .
# Run:
#   docker run --rm -p 3000:3000 \
#     -e DATABASE_URL=postgres://... -e DEMO_MODE=true \
#     freelance-radar

# -----------------------------------------------------------------------------
# Base — pnpm via corepack
# -----------------------------------------------------------------------------
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

# -----------------------------------------------------------------------------
# Prep — rewrite workspace:* to ^1.0.0 so deps resolve from the npm registry
# -----------------------------------------------------------------------------
FROM base AS prep
COPY package.json ./
RUN node -e "const p=require('./package.json'); \
  for (const k of ['dependencies','devDependencies']) { \
    if (!p[k]) continue; \
    for (const dep of Object.keys(p[k])) { \
      if (p[k][dep] === 'workspace:*') p[k][dep] = '^1.0.0'; \
    } \
  } \
  require('fs').writeFileSync('./package.json', JSON.stringify(p, null, 2));"

# -----------------------------------------------------------------------------
# Deps — install with the rewritten manifest
# -----------------------------------------------------------------------------
FROM base AS deps
COPY --from=prep /app/package.json ./
RUN pnpm install --no-frozen-lockfile

# -----------------------------------------------------------------------------
# Build — produce the Next.js standalone output
# -----------------------------------------------------------------------------
FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=prep /app/package.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Re-apply the rewritten package.json (COPY . . overwrote it).
COPY --from=prep /app/package.json ./
RUN pnpm exec next build

# -----------------------------------------------------------------------------
# Runner — production image
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
USER nextjs

COPY --from=build --chown=nextjs:nodejs /app/.next ./.next
COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nextjs:nodejs /app/package.json ./
COPY --from=build --chown=nextjs:nodejs /app/next.config.ts ./
COPY --from=build --chown=nextjs:nodejs /app/flowpanel.config.ts ./
COPY --from=build --chown=nextjs:nodejs /app/src ./src
COPY --from=build --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=build --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=build --chown=nextjs:nodejs /app/tsconfig.json ./

EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
