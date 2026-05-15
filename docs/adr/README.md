# Architecture Decision Records

Each ADR captures a design choice that's costly to reverse. Format follows
Michael Nygard's classic shape — Status, Context, Decision, Consequences.
Numbered sequentially.

| #    | Title                                                  | Status   |
| ---- | ------------------------------------------------------ | -------- |
| 0001 | TypeScript module augmentation for `db` typing         | Accepted |
| 0002 | Publisher abstraction (memory + Redis)                 | Accepted |
| 0003 | Eject targets — resource, dashboard, layout (no fourth)| Accepted |
| 0004 | `exactOptionalPropertyTypes` discipline                | Accepted |
| 0005 | Two ORM adapters at 1.0 (Drizzle + Prisma)             | Accepted |

New ADRs should be added when:

- A public-API contract is introduced or changed (cite the ADR in `docs/invariants.md`).
- A non-obvious architectural choice is made that future contributors will
  question.
- A previously accepted decision is reversed (the new ADR supersedes the old;
  mark the old one `Status: Superseded by 000N`).

Keep ADRs short — 80 to 200 lines. They are decision artifacts, not
documentation. Long-form prose belongs in `docs/reference/` or the docs site.
