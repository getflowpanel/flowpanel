import {
  Building2,
  Database,
  LayoutDashboard,
  Link2,
  ListChecks,
  PanelRight,
  Radio,
  ShieldCheck,
  TestTube,
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
    desc: "List, create, edit and delete. Columns, filters and forms are checked against your schema.",
  },
  {
    icon: LayoutDashboard,
    title: "Dashboards",
    desc: "Metrics, bars, funnels, charts, timelines, heatmaps, checklists and trackers, with a date range and dashboard filters.",
  },
  {
    icon: Database,
    title: "Typed widget reads",
    desc: "ctx.read and ctx.count take a typed where and apply the same roles and tenant scope as the list.",
  },
  {
    icon: PanelRight,
    title: "Record pages",
    desc: "A header, a stats strip, tabs of related rows and a side column, with their own date range.",
  },
  {
    icon: Link2,
    title: "Links by name",
    desc: "Point a card at a resource, a filtered list or a dashboard by name. A misspelt name fails at boot, not in production.",
  },
  {
    icon: ShieldCheck,
    title: "Auth, roles and audit",
    desc: "Clerk, Better Auth, Auth.js or Lucia. Your session type flows through, and every write can be audited.",
  },
  {
    icon: Building2,
    title: "Multi-tenant scope",
    desc: "Fail-closed row scoping per tenant, enforced on every query.",
  },
  {
    icon: Radio,
    title: "Queues and realtime",
    desc: "BullMQ queue pages, and lists and widgets that update over SSE: in memory for dev, Redis in production.",
  },
  {
    icon: TestTube,
    title: "A smoke test included",
    desc: "smokeAdmin from @flowpanel/test opens every page, a record from each list and its tabs, and fails on any error card.",
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
          What ships in the box.
        </h2>

        <ul className="mt-12 grid gap-px overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-border)] sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <li
              key={f.title}
              className="bg-[var(--color-bg)] p-6 transition-colors duration-200 hover:bg-[var(--color-bg-subtle)] md:p-7"
            >
              <f.icon aria-hidden className="h-5 w-5 text-[var(--color-fg-muted)]" />
              <h3 className="mt-4 text-base font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-fg-muted)]">{f.desc}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
