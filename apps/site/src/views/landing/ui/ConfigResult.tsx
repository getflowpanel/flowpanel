import { highlightTs } from "@/shared/ui/code-block";

const CONFIG = `import { defineAdmin, resource } from "@flowpanel/kit";
import { drizzleAdapter } from "@flowpanel/kit/drizzle";
import { withClerk } from "@flowpanel/kit/auth";
import { db } from "@/db";
import * as schema from "@/db/schema";

export default defineAdmin({
  adapter: drizzleAdapter({ db, schema }),
  auth: withClerk({ requireRole: "admin" }),
  resources: [
    resource(schema.jobs, {
      columns: ["title", "platform", "category", "priceUsd", "postedAt"],
      filters: [{ field: "platform", type: "select" }],
    }),
  ],
});`;

const OUTCOMES: ReadonlyArray<{ lead: string; rest: string }> = [
  { lead: "A typed table", rest: "— exactly the five columns you listed, in order." },
  { lead: "A platform filter", rest: "— faceted, URL-synced, shareable." },
  { lead: "Search, sort, pagination and a row drawer", rest: "— included, nothing wired." },
  { lead: "Type-checked end to end", rest: "— misspell a column and it won't compile." },
];

export function ConfigResult() {
  return (
    <section
      aria-labelledby="config-title"
      className="border-b border-[var(--color-border)] py-28 md:py-36"
    >
      <div className="mx-auto max-w-[1120px] px-6">
        <h2
          id="config-title"
          className="max-w-[20ch] text-balance text-4xl font-semibold tracking-[-0.02em] md:text-5xl"
        >
          This config becomes this admin.
        </h2>
        <p className="mt-4 max-w-[58ch] text-lg text-[var(--color-fg-muted)]">
          No page tree to scaffold or maintain. Add a column to your schema, list it — the typed UI
          follows. Everything you don&apos;t list stays out.
        </p>

        <div className="mt-12 grid gap-x-12 gap-y-8 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-[var(--shadow-code)]">
            <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-2.5">
              <span aria-hidden className="h-2 w-2 rounded-full bg-[var(--color-accent)]" />
              <span className="font-mono text-xs text-[var(--color-fg-subtle)]">
                flowpanel.config.ts
              </span>
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-[var(--color-fg)]">
              <code>{highlightTs(CONFIG)}</code>
            </pre>
          </div>

          <ul className="flex flex-col gap-5">
            {OUTCOMES.map((o) => (
              <li key={o.lead} className="flex gap-3">
                <span
                  aria-hidden
                  className="mt-[0.5rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]"
                />
                <p className="text-[var(--color-fg-muted)]">
                  <span className="font-medium text-[var(--color-fg)]">{o.lead}</span> {o.rest}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
