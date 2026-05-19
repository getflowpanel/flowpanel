---
"@flowpanel/cli": patch
---

`flowpanel init` now scaffolds a working Prisma config when the user's project uses Prisma. Previously the command aborted with "Prisma support lands in 1.1" despite `@flowpanel/adapter-prisma` shipping. The init now branches on detected ORM, picks the corresponding scaffold template (`flowpanel.config.drizzle.ts.txt` or `flowpanel.config.prisma.ts.txt`), and asks ORM-appropriate prompts (Drizzle gets db + schema paths; Prisma gets only db path since `prismaAdapter` introspects via DMMF at runtime). `flowpanel migrate` error message no longer hardcodes `drizzleAdapter`.
