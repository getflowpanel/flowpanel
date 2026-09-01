# syntax=docker/dockerfile:1
# Monorepo-context build of the ai-scraper public demo.
# Builds straight from workspace source — NO npm publish required.
#
# Build from the REPO ROOT (not this directory):
#   docker build -f examples/ai-scraper/Dockerfile -t ai-scraper .
#
# Coolify: Base Directory "/", Dockerfile "examples/ai-scraper/Dockerfile",
# port 3000. Needs a fresh or already sandbox-shaped Postgres reachable via
# DATABASE_URL at runtime; see the README's one-time upgrade note. On boot the
# container applies the current schema, then serves. Browser sandboxes seed lazily.

FROM node:22-alpine AS build
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /repo

# Full workspace source. node_modules / .next / dist excluded via the root
# .dockerignore, so the in-image install below is authoritative.
COPY . .
RUN pnpm install --frozen-lockfile

# Build the framework packages the demo imports, then the demo app itself.
# A placeholder DATABASE_URL keeps `next build` happy without a live DB
# (every admin route is server-rendered on demand, not statically generated).
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=postgres://placeholder:placeholder@localhost:5432/placeholder
# Build the demo and every workspace package it (transitively) depends on,
# in topological order. The `...` suffix pulls in the flowpanel umbrella and
# all @flowpanel/* packages it re-exports (core, react, next, charts, client,
# adapter-drizzle, adapter-prisma, adapter-bullmq) so DTS never races a
# missing sibling on a clean build.
RUN pnpm --filter "ai-scraper..." build

WORKDIR /repo/examples/ai-scraper
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

# Public data is provisioned per browser on first use; container restarts never
# rewrite live visitor sandboxes.
CMD ["sh", "-c", "pnpm db:push && pnpm start"]
