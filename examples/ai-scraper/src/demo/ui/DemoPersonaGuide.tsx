import type { DemoRole } from "../auth/role";

const GITHUB_URL = "https://github.com/getflowpanel/flowpanel";

export function DemoPersonaGuide({ role }: { role: DemoRole }) {
  return (
    <section aria-label="FlowPanel demo" className="bg-slate-950 text-white">
      <div className="mx-auto flex min-h-11 max-w-7xl items-center gap-1.5 px-3 sm:gap-2 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-fp-accent" />
          <span className="whitespace-nowrap text-[11px] font-semibold tracking-tight sm:text-xs">
            FlowPanel demo
          </span>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
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
                  className={`min-h-11 rounded-fp-sm px-2 text-[11px] font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:px-2.5 sm:text-xs ${
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
            href={GITHUB_URL}
            aria-label="View on GitHub"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center rounded-fp-sm bg-white px-2 text-[11px] font-semibold whitespace-nowrap text-slate-950 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:px-2.5 sm:text-xs"
          >
            <span className="hidden sm:inline">View on&nbsp;</span>GitHub
            <span aria-hidden="true" className="ml-1">
              ↗
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
