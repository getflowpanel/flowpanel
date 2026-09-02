import { ArrowUpRight } from "lucide-react";
import { siteConfig } from "@/shared/lib/site-config";

const linkClass =
  "inline-flex min-h-11 touch-manipulation items-center gap-1.5 font-mono text-sm text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]";

export function SeeItRunning() {
  const demo = siteConfig.links.demo;

  return (
    <section
      id="demo"
      aria-labelledby="demo-title"
      className="scroll-mt-20 border-b border-[var(--color-border)] py-20 md:py-24"
    >
      <div className="mx-auto max-w-[1120px] px-6">
        <h2
          id="demo-title"
          className="max-w-[20ch] text-balance text-4xl font-semibold tracking-[-0.02em] md:text-5xl"
        >
          See it running.
        </h2>
        <p className="mt-4 max-w-[58ch] text-lg text-[var(--color-fg-muted)]">
          Two complete admins live in the repo, seeded and runnable. Read the config that produced
          them, or follow each README to start one locally.
        </p>

        {demo ? (
          <a
            href={demo}
            target="_blank"
            rel="noreferrer"
            className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--color-accent)] px-5 py-3 font-mono text-sm font-medium text-[var(--color-accent-fg)] transition-colors hover:bg-[var(--color-accent-hover)]"
          >
            <span>Open the live demo</span>
            <ArrowUpRight aria-hidden className="h-4 w-4" />
          </a>
        ) : null}

        <ul className="mt-12 grid gap-6 md:grid-cols-2">
          {siteConfig.examples.map((example) => (
            <li
              key={example.name}
              className="flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6 shadow-[var(--shadow-card)]"
            >
              <a
                href={example.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 font-mono text-sm font-medium text-[var(--color-fg)] transition-opacity hover:opacity-80"
              >
                examples/{example.name}
                <ArrowUpRight aria-hidden className="h-4 w-4 text-[var(--color-fg-subtle)]" />
              </a>
              <p className="mt-3 flex-1 text-sm text-[var(--color-fg-muted)]">{example.summary}</p>
              <div className="mt-4 flex flex-wrap items-center gap-x-6 border-t border-[var(--color-border)] pt-1">
                <a href={example.config} target="_blank" rel="noreferrer" className={linkClass}>
                  Read the config
                  <ArrowUpRight aria-hidden className="h-4 w-4" />
                </a>
                <a href={example.readme} target="_blank" rel="noreferrer" className={linkClass}>
                  Run it locally
                  <ArrowUpRight aria-hidden className="h-4 w-4" />
                </a>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
