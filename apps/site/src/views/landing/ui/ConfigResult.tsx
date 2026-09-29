import { highlightTs } from "@/shared/ui/code-block";

const CONFIG = `import { dashboard, defineAdmin, metric, resource } from "@flowpanel/kit";
import { drizzleAdapter } from "@flowpanel/kit/drizzle";
import { withClerk } from "@flowpanel/kit/auth";
import { db } from "@/db";
import * as schema from "@/db/schema";

export default defineAdmin({
  adapter: drizzleAdapter({ db, schema }),
  auth: withClerk({ requireRole: "admin" }),
  resources: [
    resource(schema.jobs, {
      columns: ["title", "platform", "priceUsd", "postedAt"],
      search: ["title"],
      filters: [
        {
          field: "platform",
          type: "select",
          options: ["LinkedIn", "Remote OK", "Wellfound"],
        },
      ],
    }),
  ],
  dashboards: [
    dashboard({
      path: "/",
      label: "Overview",
      dateRange: { preset: "last7d" },
      sections: [
        {
          widgets: [
            metric("New LinkedIn jobs", {
              count: "jobs",
              where: { platform: "LinkedIn" },
              range: "postedAt",
            }),
          ],
        },
      ],
    }),
  ],
});`;

const OUTCOMES: ReadonlyArray<{ lead: string; rest: string }> = [
  { lead: "A typed table", rest: "— exactly the four columns you listed, in order." },
  { lead: "A platform filter", rest: "— URL-synced and shareable." },
  {
    lead: "Search, sort and pagination",
    rest: "— sort and pages by default, search on the fields you name.",
  },
  { lead: "A count that links to its rows", rest: "— typed where, same access rules as the list." },
  { lead: "Type-checked end to end", rest: "— misspell a column and it won't compile." },
];

export function ConfigResult() {
  return (
    <section
      aria-labelledby="config-title"
      className="border-b border-[var(--color-border)] py-20 md:py-24"
    >
      <div className="mx-auto max-w-[1120px] px-6">
        <h2
          id="config-title"
          className="max-w-[20ch] text-balance text-4xl font-semibold tracking-[-0.02em] md:text-5xl"
        >
          This config becomes this admin.
        </h2>
        <p className="mt-4 max-w-[58ch] text-lg text-[var(--color-fg-muted)]">
          No pages to write per table. Add a column to your schema and list it; the typed UI
          follows. Anything you don&apos;t list stays out.
        </p>

        <div className="mt-12 grid gap-x-12 gap-y-8 lg:grid-cols-[1.5fr_1fr] lg:items-start">
          <div className="min-w-0 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-[var(--shadow-code)]">
            <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-2.5">
              <span aria-hidden className="h-2 w-2 rounded-full bg-[var(--color-border-strong)]" />
              <span className="font-mono text-xs text-[var(--color-fg-subtle)]">
                flowpanel.config.ts
              </span>
            </div>
            <pre className="break-words whitespace-pre-wrap p-4 font-mono text-[13px] leading-relaxed text-[var(--color-fg)]">
              <code>{highlightTs(CONFIG)}</code>
            </pre>
          </div>

          <ul className="flex flex-col gap-5 lg:sticky lg:top-24 lg:pt-12">
            {OUTCOMES.map((o) => (
              <li key={o.lead} className="flex gap-3">
                <span
                  aria-hidden
                  className="mt-[0.5rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-fg-subtle)]"
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
