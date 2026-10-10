import { type SQL, sql } from "drizzle-orm";

/** The admin writes each event under its sandbox's scope, so removing a sandbox removes its history too. */
export async function deleteSandboxAudit(
  db: { execute(query: SQL): Promise<unknown> },
  sandboxIds: readonly string[],
): Promise<void> {
  if (sandboxIds.length === 0) return;
  await db.execute(
    sql`delete from flowpanel_audit_log where scope_key::jsonb ->> 'sandboxId' in (${sql.join(
      sandboxIds.map((id) => sql`${id}`),
      sql`, `,
    )})`,
  );
}
