import { AppWindow, Database, ShieldCheck, Waypoints } from "lucide-react";
import Link from "next/link";

const PROOFS = [
  {
    title: "Runs inside your Next.js app",
    description: "The admin, handlers, auth and database client ship with the application you own.",
    href: "/docs/introduction/why-flowpanel",
    linkLabel: "See the architecture",
    icon: AppWindow,
  },
  {
    title: "No external control plane",
    description: "FlowPanel does not receive your database credentials or application rows.",
    href: "/docs/introduction/why-flowpanel",
    linkLabel: "Review data ownership",
    icon: Database,
  },
  {
    title: "Server-enforced policy",
    description: "Roles, operations, fields and tenant scope are checked again on every request.",
    href: "/docs/guides/permissions",
    linkLabel: "Inspect authorization",
    icon: ShieldCheck,
  },
  {
    title: "You keep operational control",
    description:
      "Identity, migrations, deployment, observability and infrastructure remain explicit.",
    href: "/docs/guides/multi-tenant-scope",
    linkLabel: "Understand tenant scope",
    icon: Waypoints,
  },
] as const;

export function ProductionModel() {
  return (
    <section
      aria-labelledby="production-model-title"
      className="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] py-16 md:py-20"
    >
      <div className="mx-auto max-w-[1120px] px-6">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--color-accent)]">
              Production model
            </p>
            <h2
              id="production-model-title"
              className="mt-3 max-w-[22ch] text-3xl font-semibold tracking-[-0.02em] md:text-4xl"
            >
              Your application stays the security boundary.
            </h2>
          </div>
          <Link
            href="/docs/guides/production-readiness"
            className="inline-flex min-h-11 items-center font-mono text-sm font-medium text-[var(--color-accent)] transition-colors hover:text-[var(--color-accent-hover)]"
          >
            Open the production checklist →
          </Link>
        </div>

        <div className="mt-10 grid border-y border-[var(--color-border)] sm:grid-cols-2 lg:grid-cols-4">
          {PROOFS.map(({ title, description, href, linkLabel, icon: Icon }, index) => (
            <article
              key={title}
              className={`py-6 sm:px-6 lg:py-7 ${
                index > 0 ? "border-t border-[var(--color-border)] sm:border-t-0" : ""
              } ${index % 2 === 1 ? "sm:border-l sm:border-[var(--color-border)]" : ""} ${
                index > 1 ? "sm:border-t sm:border-[var(--color-border)] lg:border-t-0" : ""
              } ${index > 0 ? "lg:border-l lg:border-[var(--color-border)]" : ""}`}
            >
              <Icon aria-hidden className="h-5 w-5 text-[var(--color-accent)]" />
              <h3 className="mt-4 text-base font-medium">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-fg-muted)]">
                {description}
              </p>
              <Link
                href={href}
                className="mt-4 inline-flex min-h-11 items-center font-mono text-xs text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
              >
                {linkLabel} →
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
