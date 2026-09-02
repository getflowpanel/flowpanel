import type { DemoRole } from "../auth/role";
import { demoLinks } from "../links";
import { FlowpanelMark } from "./FlowpanelMark";

const control =
  "inline-flex min-h-11 items-center rounded-fp-sm px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:min-h-8";

export function DemoPersonaGuide({ role }: { role: DemoRole }) {
  return (
    <section
      aria-label="FlowPanel demo"
      className="border-b border-white/10 bg-slate-950 text-white"
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:gap-5 sm:px-6">
        <a
          href={demoLinks.site}
          className="flex min-w-0 items-center gap-2 rounded-fp-sm text-sm font-medium tracking-tight transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <FlowpanelMark size={20} className="shrink-0 text-fp-accent" />
          <span className="truncate">FlowPanel demo</span>
        </a>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3">
          <fieldset
            aria-label="Demo persona"
            className="flex items-center rounded-fp-sm border border-white/10 bg-white/5 p-0.5"
          >
            {(["admin", "support"] as const).map((persona) => (
              <form action="/api/demo/role" method="post" key={persona}>
                <input type="hidden" name="role" value={persona} />
                <button
                  type="submit"
                  aria-pressed={role === persona}
                  className={`${control} capitalize ${
                    role === persona
                      ? "bg-white text-slate-950 shadow-fp-xs"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
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
            className={`${control} text-slate-300 hover:bg-white/10 hover:text-white`}
          >
            Config
          </a>
          <a
            href={demoLinks.repo}
            aria-label="View on GitHub"
            target="_blank"
            rel="noreferrer"
            className={`${control} text-slate-300 hover:bg-white/10 hover:text-white`}
          >
            GitHub
          </a>
        </div>
      </div>
    </section>
  );
}
