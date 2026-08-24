import { ArrowUpRight } from "lucide-react";
import { siteConfig } from "@/shared/lib/site-config";
import { CodeBlock, PromptLine } from "@/shared/ui/code-block";

const CLONE_STEPS = [
  "git clone https://github.com/getflowpanel/flowpanel && cd flowpanel",
  'pnpm install && pnpm --filter "./packages/*" build',
  "cd examples/ai-scraper && pnpm docker:up && pnpm db:push && pnpm db:seed && pnpm dev",
];

export function SeeItRunning() {
  const demo = siteConfig.links.demo;

  return (
    <section
      id="demo"
      aria-labelledby="demo-title"
      className="scroll-mt-20 border-b border-[var(--color-border)] py-28 md:py-36"
    >
      <div className="mx-auto max-w-[1120px] px-6">
        <h2
          id="demo-title"
          className="max-w-[20ch] text-balance text-4xl font-semibold tracking-[-0.02em] md:text-5xl"
        >
          See it running.
        </h2>
        <p className="mt-4 max-w-[58ch] text-lg text-[var(--color-fg-muted)]">
          Two complete admins live in the repo, seeded and runnable. Read the config, or start one
          locally — Postgres comes up in Docker.
        </p>

        <div className="mt-12 grid gap-10 md:grid-cols-[1fr_1.25fr] md:items-start">
          <ul className="space-y-5">
            {siteConfig.examples.map((example) => (
              <li key={example.name}>
                <a
                  href={example.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group block rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5 shadow-[var(--shadow-card)] transition-colors hover:border-[var(--color-border-strong)]"
                >
                  <span className="inline-flex items-center gap-2 font-mono text-sm font-medium text-[var(--color-fg)]">
                    examples/{example.name}
                    <ArrowUpRight
                      aria-hidden
                      className="h-4 w-4 text-[var(--color-fg-subtle)] transition-colors group-hover:text-[var(--color-fg)]"
                    />
                  </span>
                  <span className="mt-2 block max-w-[46ch] text-sm text-[var(--color-fg-muted)]">
                    {example.summary}
                  </span>
                </a>
              </li>
            ))}
          </ul>

          <div className="min-w-0">
            <CodeBlock className="overflow-x-auto">
              {CLONE_STEPS.map((command, i) => (
                <span key={command}>
                  {i > 0 ? "\n" : null}
                  <PromptLine command={command} />
                </span>
              ))}
            </CodeBlock>
            <p className="mt-3 text-sm text-[var(--color-fg-muted)]">
              The admin lands on{" "}
              <span className="font-mono text-[var(--color-fg)]">localhost:3000/admin</span>. Docker
              Desktop has to be running; no <span className="font-mono">.env</span> is needed for
              the local run.
            </p>
            {demo ? (
              <a
                href={demo}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-5 py-3 font-mono text-sm font-medium text-[var(--color-accent-fg)] transition-colors hover:bg-[var(--color-accent-hover)]"
              >
                <span>Open the live demo</span>
                <ArrowUpRight aria-hidden className="h-4 w-4" />
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
