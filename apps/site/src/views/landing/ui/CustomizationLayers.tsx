import { CodeBlock, OutputLine, PromptLine } from "@/shared/ui/code-block";

interface Layer {
  level: string;
  tag: string;
  title: string;
  description: string;
  code: React.ReactNode;
}

const LAYERS: ReadonlyArray<Layer> = [
  {
    level: "L1",
    tag: "props",
    title: "Tweak with config",
    description: "Override a column renderer, add a row action, hide a field.",
    code: <>{`columns: { status: { cell: (r) => r.status } }`}</>,
  },
  {
    level: "L2",
    tag: "theme",
    title: "Swap any of 10 slots",
    description: "Replace the shell, table, drawer, or form with your own component.",
    code: <>{`theme: { components: { Table: MyTable } }`}</>,
  },
  {
    level: "L3",
    tag: "eject",
    title: "Take the source",
    description:
      "One command writes a five-file scaffold into your repo. Each file stamped — it's yours.",
    code: (
      <>
        <PromptLine command="pnpm flowpanel eject resource users" />
        {"\n"}
        <OutputLine text="wrote 5 files to app/admin/users/" />
      </>
    ),
  },
];

export function CustomizationLayers() {
  return (
    <section
      aria-labelledby="layers-title"
      className="border-b border-[var(--color-border)] py-28 md:py-40"
    >
      <div className="mx-auto max-w-[1120px] px-6">
        <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-fg-muted)]">
          <span aria-hidden className="text-[var(--color-fg-subtle)]">
            ●
          </span>
          <span>02 Customization</span>
        </p>
        <h2
          id="layers-title"
          className="mt-6 text-balance text-4xl font-semibold tracking-tight md:text-5xl"
        >
          Three layers. Take only what you need.
        </h2>
        <p className="mt-5 max-w-[60ch] text-lg text-[var(--color-fg-muted)]">
          Stay declarative, swap a single component, or own the source. The escape hatch is one
          command away — and you never lose typing.
        </p>

        <ul className="mt-16 space-y-6">
          {LAYERS.map((layer) => (
            <li
              key={layer.level}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6 md:p-8"
            >
              <div className="grid gap-x-6 gap-y-3 md:grid-cols-[120px_1fr] md:gap-x-10">
                <div>
                  <p className="font-mono text-sm font-semibold tracking-tight text-[var(--color-fg)]">
                    {layer.level}
                  </p>
                  <p className="mt-1 font-mono text-xs text-[var(--color-fg-subtle)]">
                    {layer.tag}
                  </p>
                </div>
                <div className="min-w-0">
                  <h3 className="text-xl font-semibold tracking-tight">{layer.title}</h3>
                  <p className="mt-3 max-w-[60ch] text-[var(--color-fg-muted)]">
                    {layer.description}
                  </p>
                  <div className="mt-5">
                    <CodeBlock>{layer.code}</CodeBlock>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
