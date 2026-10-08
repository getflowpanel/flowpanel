import type { DemoRole } from "../auth/role";
import { demoLinks } from "../links";

const control =
  "inline-flex min-h-11 items-center rounded-sm px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-demo-accent sm:min-h-8";

export function DemoPersonaGuide({ role }: { role: DemoRole }) {
  return (
    <section
      aria-label="ScrapeAI"
      className="border-b border-demo-border bg-demo-surface text-demo-text"
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:gap-5 sm:px-6">
        <a
          href="/admin"
          className="min-w-0 truncate rounded-sm text-sm font-medium tracking-tight transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-demo-accent"
        >
          ScrapeAI
        </a>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3">
          <fieldset
            aria-label="Demo persona"
            className="flex items-center rounded-sm border border-demo-border bg-demo-page p-0.5"
          >
            {(["admin", "support"] as const).map((persona) => (
              <form action="/api/demo/role" method="post" key={persona}>
                <input type="hidden" name="role" value={persona} />
                <button
                  type="submit"
                  aria-pressed={role === persona}
                  className={`${control} capitalize ${
                    role === persona
                      ? "bg-demo-surface text-demo-text shadow-demo-xs ring-1 ring-demo-border"
                      : "text-demo-muted hover:bg-demo-hover hover:text-demo-text"
                  }`}
                >
                  {persona}
                </button>
              </form>
            ))}
          </fieldset>

          <a
            href={demoLinks.config}
            target="_blank"
            rel="noreferrer"
            className={`${control} text-demo-muted hover:bg-demo-hover hover:text-demo-text`}
          >
            Config
          </a>
          <a
            href={demoLinks.repo}
            aria-label="View on GitHub"
            target="_blank"
            rel="noreferrer"
            className={`${control} text-demo-muted hover:bg-demo-hover hover:text-demo-text`}
          >
            GitHub
          </a>
        </div>
      </div>
    </section>
  );
}
