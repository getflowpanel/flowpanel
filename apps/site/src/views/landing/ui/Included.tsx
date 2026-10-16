import { Section } from "./Section";

const ITEMS: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: "Lists and forms",
    body: "Sorting and pagination on every list, plus the search fields and filters you name. Forms infer number, date, boolean, JSON and enum inputs from your schema, and a record picker for a column with a reference; declare fields for validation.",
  },
  {
    title: "Dashboards and record pages",
    body: "Metrics, charts and tables over a date range. Record pages show a header, stats and tabs of related rows.",
  },
  {
    title: "Access control",
    body: "Uses the Clerk, Better Auth, Auth.js or Lucia session your app already has. Roles and tenant scope are checked on the server for every request.",
  },
  {
    title: "Audit log",
    body: "Every write the admin makes can be recorded with who made it and what changed, shown on each record's History tab and on one Audit log page.",
  },
  {
    title: "Import and export",
    body: "Export every row that matches the list's filters, not only the page on screen, as CSV or JSON. Import a file through the same validation and access checks as the form.",
  },
  {
    title: "Queues and realtime",
    body: "BullMQ queue pages. Lists and widgets update over server-sent events.",
  },
  {
    title: "A smoke test",
    body: "One Playwright call opens every dashboard and list, the record pages of the first rows and their tabs, and fails on an error card, a console error or a failed request.",
  },
  {
    title: "Custom code",
    body: "Write a custom widget, replace a built-in component, or eject a resource into plain Next.js pages.",
  },
];

export function Included() {
  return (
    <Section id="included" title="What's included">
      <dl className="grid gap-x-12 gap-y-10 sm:grid-cols-2">
        {ITEMS.map((item) => (
          <div key={item.title}>
            <dt className="font-medium text-[var(--color-fg)]">{item.title}</dt>
            <dd className="mt-2 leading-relaxed text-[var(--color-fg-muted)]">{item.body}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
