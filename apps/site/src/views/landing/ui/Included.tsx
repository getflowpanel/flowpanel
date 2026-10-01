import { Section } from "./Section";

const ITEMS: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: "Lists and forms",
    body: "Sorting and pagination on every list, plus the search fields and filters you name. Create and edit forms follow your schema.",
  },
  {
    title: "Dashboards and record pages",
    body: "Metrics, charts and tables over a date range. Record pages show a header, stats and tabs of related rows.",
  },
  {
    title: "Access control",
    body: "Sign-in through Clerk, Better Auth or Auth.js. Roles and tenant scope are checked on the server for every request.",
  },
  {
    title: "Queues and realtime",
    body: "BullMQ queue pages. Lists and widgets update over server-sent events.",
  },
  {
    title: "Runs in your app",
    body: "The admin is a route in your Next.js app. FlowPanel never receives your database credentials or rows.",
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
