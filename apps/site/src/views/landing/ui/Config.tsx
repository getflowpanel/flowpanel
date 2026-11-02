import { highlightTs } from "@/shared/ui/code-block";
import { Section } from "./Section";

const CONFIG = `import { defineAdmin, resource } from "@flowpanel/kit";
import { withClerk } from "@flowpanel/kit/auth";
import { drizzleAdapter } from "@flowpanel/kit/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";

export default defineAdmin({
  adapter: drizzleAdapter({ db, schema }),
  auth: withClerk({ access: "admin" }),
  resources: [
    resource(schema.customers, {
      columns: ["email", "plan", "status", "mrr", "createdAt"],
      search: ["email"],
      filters: [
        { field: "plan", type: "select", options: ["free", "starter", "pro", "business"] },
      ],
    }),
  ],
});`;

export function Config() {
  return (
    <Section
      id="config"
      title="A typed config"
      lead="List the tables and columns you want, in one file or one per resource. Anything you leave out stays hidden. With Drizzle, or a registered Prisma model, a misspelt column name fails the type check."
    >
      <figure className="min-w-0">
        <figcaption className="font-mono text-xs text-[var(--color-fg-subtle)]">
          flowpanel.config.ts
        </figcaption>
        <pre className="mt-3 overflow-x-auto whitespace-pre rounded-lg bg-[var(--color-bg-subtle)] p-4 font-mono text-xs leading-relaxed text-[var(--color-fg)] sm:p-6 sm:text-[13px]">
          <code>{highlightTs(CONFIG)}</code>
        </pre>
      </figure>
    </Section>
  );
}
