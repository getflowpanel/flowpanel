# Recipes

Patterns that come up on every real admin, written with actual code and
checklists — not sales pitch. If a pattern needs more than one page, it
grew beyond "recipe" and belongs in `docs/reference/`.

| Recipe | When |
|---|---|
| [Multi-tenant admin](./multi-tenant.md) | SaaS with a `tenantId`/`organizationId` scope on most tables |
| [File uploads](./file-uploads.md) | Any column that stores a URL pointing at S3/R2/Supabase Storage |
| [JSONB / JSON editor](./jsonb-editor.md) | Postgres `jsonb`, Prisma `Json`, Drizzle `jsonb()` columns |

Each page ends with a pre-ship checklist and a "what we deliberately don't
do" section — worth reading to understand where FlowPanel chose to stay
thin.
