# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in FlowPanel, please report it responsibly:

1. **Do not** open a public GitHub issue.
2. Email `security@flowpanel.dev` — or, until that domain is live, open a
   [GitHub security advisory](https://github.com/Ch4m4/flowpanel/security/advisories/new).
3. Include: description, reproduction steps, impact assessment, affected
   version / commit.

We acknowledge within 48 hours, ship a fix on a private branch, coordinate
disclosure, and credit you in the release notes unless you prefer otherwise.

## Supported versions

| Version | Supported |
|---|---|
| `0.x` (pre-1.0) | Only the latest minor. Pre-1.0 means we can break APIs to fix a CVE. |

## Threat model

### In scope

- **Authorisation bypass via the admin tRPC router.** A user must not be able
  to list / get / update / delete / act on a resource that violates the
  configured `access` rule, `rowLevel` scope, or `when` predicate. This is
  what `security.*` is for and what every request goes through.
- **Session hijack resistance.** `stepUp: true` actions must require the
  configured step-up check; a session cookie alone must not be enough to
  execute destructive actions if step-up is configured.
- **SQL injection.** All adapter-level filter generation is parameterised.
  Adapter authors MUST route user input through the parameter slot, never
  via string interpolation.
- **Cross-tenant data leaks.** `security.rowLevel.filter` scalars are
  enforced on list / get / update / delete / action / actionBulk.
- **Admin-endpoint enumeration.** Rows outside the caller's scope return
  `NOT_FOUND` — indistinguishable from "does not exist" — so scope
  boundaries aren't probe-able.
- **Redaction in errors.** Field-level `redacted: true` keeps sensitive
  column values out of the rendered error output.

### Out of scope

- **DoS via expensive queries.** Rate limiting exists per-endpoint per-user,
  but FlowPanel does not analyse your query cost. Pair it with Postgres
  statement_timeout.
- **SSE connection exhaustion.** The stream handler caps concurrent
  connections per process. Run multiple instances behind a load balancer
  for higher ceilings — FlowPanel doesn't orchestrate clusters.
- **Your `getSession` implementation.** FlowPanel accepts whatever
  `security.auth.getSession(req)` returns. Cookie rotation, CSRF protection,
  session fixation hardening are the host app's responsibility.
- **Browser-side bundle integrity.** Subresource integrity, CSP rules,
  and everything around `<script>` tag trust live in your Next.js app.
- **Dependency supply chain.** We pin `@trpc/server` and `zod` as peers,
  our lockfile is committed, but audits of `zod`'s transitive deps are
  not FlowPanel's job.

## Enforcement surface — where the guarantees live

Every security claim above has a test that proves it. If you're auditing
FlowPanel, start here:

| Guarantee | Enforced in | Tested in |
|---|---|---|
| Access rule (`access.*`) refuses 403 | `trpc/procedures/resource/{crud,actions}.ts` | `__tests__/trpc/*` |
| `rowLevel` scope on list | `trpc/procedures/resource/crud.ts` (`buildFilters`) | `resources-rowlevel.test.ts:133` |
| `rowLevel` scope on get / update / delete | `crud.ts:121,185-189,226-230` (pre-fetch + compare) | `resources-rowlevel.test.ts:153,185,202` |
| `rowLevel` scalar forced on create | `crud.ts:147-152` | `resources-rowlevel.test.ts:219` |
| `rowLevel` scope on action / bulk / dialog | `trpc/procedures/resource/actions.ts` | `resources-rowlevel.test.ts` (extended coverage below) |
| SQL injection prevention | adapter filter builders parameterise every value | `adapter-{drizzle,prisma}/src/__tests__/filters.test.ts` |
| First-boot error surface | `errors/preflight.ts` | `errors/__tests__/preflight.test.ts` |
| Audit log capture | `trpc/middleware/auditLog.ts` | `__tests__/audit-hook.test.ts` |

## Running the security suite

```bash
pnpm --filter @flowpanel/core test:unit
# includes 7 rowLevel bypass attempts + the audit + the preflight suite
pnpm --filter @flowpanel/adapter-drizzle test
pnpm --filter @flowpanel/adapter-prisma test:unit
# parameterisation tests for each dialect
```

CI runs all of this on every PR; `main`-only matrix expands coverage to
Node 20 + 22 against Postgres 13 + 16. A red security-surface test
blocks merge.

## Security features — quick reference

- **Authentication** — pluggable `security.auth.getSession(req)`.
- **Role-based access** — `access: { list: ["admin"], update: (ctx, row) => ... }`.
- **Row-level security** — `security.rowLevel.filter` returns scalars
  that scope every read + write automatically.
- **Step-up auth** — per-action `stepUp: true` forces a re-auth check
  inside the step-up hook you configure.
- **Rate limiting** — `security.rateLimits[path] = { perMinute, perHour }`.
- **Audit logging** — `flowpanel_audit_log` + optional `audit` callback
  for forwarding to your SIEM.
- **Field redaction** — `redacted: true` on a column keeps its values
  out of serialized errors.
- **SQL injection prevention** — adapters parameterise; no string
  interpolation of user input.

## Coordinated disclosure

We treat security reports as opus-grade priority. Our rough ladder:

- Accept within 48h.
- Private fix branch, tested against the current `main` and the latest
  published minor.
- Release the patch, publish advisory with CVE (if assigned), credit
  the reporter.

Until the project has a formal CNA, CVEs go through GitHub's advisory
flow. That's fine for the current volume.
