import {
  Boxes,
  Building2,
  Command,
  LayoutDashboard,
  ListChecks,
  Moon,
  Radio,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import type { ComponentType } from "react";

interface Feature {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  desc: string;
}

const FEATURES: ReadonlyArray<Feature> = [
  {
    icon: ListChecks,
    title: "Typed CRUD",
    desc: "List, create, edit, delete — columns and filters type-checked against your schema.",
  },
  {
    icon: LayoutDashboard,
    title: "Dashboards & charts",
    desc: "Metric, table, and chart widgets with server-prerendered cells.",
  },
  {
    icon: Boxes,
    title: "BullMQ queues",
    desc: "Queue health and job UIs, surfaced straight from the adapter.",
  },
  {
    icon: Radio,
    title: "Realtime over SSE",
    desc: "Lists refresh live — in-memory driver for dev, Redis for production.",
  },
  {
    icon: ShieldCheck,
    title: "Auth & roles",
    desc: "Bring Clerk, NextAuth, or Lucia; gate the whole panel by role.",
  },
  {
    icon: Command,
    title: "⌘K command palette",
    desc: "Jump to any registered resource — included, no wiring.",
  },
  {
    icon: Building2,
    title: "Multi-tenant scope",
    desc: "Fail-closed row scoping per tenant, enforced on every query.",
  },
  {
    icon: ScrollText,
    title: "Audit log",
    desc: "A mutation audit trail with a pluggable sink.",
  },
  {
    icon: Moon,
    title: "Dark mode",
    desc: "Persists across navigations, with no first-paint flash.",
  },
];

export function FeatureGrid() {
  return (
    <section
      aria-labelledby="features-title"
      className="border-b border-[var(--color-border)] py-20 md:py-24"
    >
      <div className="mx-auto max-w-[1120px] px-6">
        <h2
          id="features-title"
          className="max-w-[24ch] text-balance text-4xl font-semibold tracking-[-0.02em] md:text-5xl"
        >
          Everything an internal tool needs — already in.
        </h2>

        <ul className="mt-12 grid gap-px overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-border)] sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <li
              key={f.title}
              className="bg-[var(--color-bg)] p-6 transition-colors duration-200 hover:bg-[var(--color-bg-subtle)] md:p-7"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-accent-subtle)] text-[var(--color-accent)]">
                <f.icon aria-hidden className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-fg-muted)]">{f.desc}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
