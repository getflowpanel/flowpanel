import type { DemoRole } from "../auth/role";
import { demoLinks } from "../links";
import { FlowpanelMark } from "./FlowpanelMark";

const control =
  "inline-flex min-h-11 items-center rounded-fp-sm px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fp-focus sm:min-h-8";

export function DemoPersonaGuide({ role }: { role: DemoRole }) {
  return (
    <section
      aria-label="FlowPanel demo"
      className="border-b border-fp-border-1 bg-fp-bg-1 text-fp-text-1"
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:gap-5 sm:px-6">
        <a
          href={demoLinks.site}
          className="flex min-w-0 items-center gap-2 rounded-fp-sm text-sm font-medium tracking-tight transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fp-focus"
        >
          <FlowpanelMark size={20} className="shrink-0 text-fp-text-1" />
          <span className="truncate">FlowPanel demo</span>
        </a>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3">
          <fieldset
            aria-label="Demo persona"
            className="flex items-center rounded-fp-sm border border-fp-border-1 bg-fp-bg-2 p-0.5"
          >
            {(["admin", "support"] as const).map((persona) => (
              <form action="/api/demo/role" method="post" key={persona}>
                <input type="hidden" name="role" value={persona} />
                <button
                  type="submit"
                  aria-pressed={role === persona}
                  className={`${control} capitalize ${
                    role === persona
                      ? "bg-fp-bg-1 text-fp-text-1 shadow-fp-xs ring-1 ring-fp-border-1"
                      : "text-fp-text-2 hover:bg-fp-bg-3 hover:text-fp-text-1"
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
            className={`${control} text-fp-text-2 hover:bg-fp-bg-3 hover:text-fp-text-1`}
          >
            Config
          </a>
          <a
            href={demoLinks.repo}
            aria-label="View on GitHub"
            target="_blank"
            rel="noreferrer"
            className={`${control} text-fp-text-2 hover:bg-fp-bg-3 hover:text-fp-text-1`}
          >
            GitHub
          </a>
        </div>
      </div>
    </section>
  );
}
