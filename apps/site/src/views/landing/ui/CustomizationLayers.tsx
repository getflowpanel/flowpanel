import { CodeBlock, highlightTs, OutputLine, PromptLine } from "@/shared/ui/code-block";

interface Layer {
  title: string;
  description: string;
  code: React.ReactNode;
}

const LAYERS: ReadonlyArray<Layer> = [
  {
    title: "Tweak with config",
    description: "Override a column renderer, add a row action, or hide a field.",
    code: highlightTs(`columns: [{ field: "status", render: (row) => row.status }]`),
  },
  {
    title: "Swap a component slot",
    description:
      "Replace any built-in — MetricCard, Badge, Pagination and seven more — with your own component.",
    code: highlightTs(`theme: { components: { MetricCard: MyMetricCard } }`),
  },
  {
    title: "Take the source",
    description: "One command writes a five-file scaffold into your repo. Every file is yours.",
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
      className="border-b border-[var(--color-border)] py-28 md:py-36"
    >
      <div className="mx-auto max-w-[1120px] px-6">
        <h2
          id="layers-title"
          className="max-w-[20ch] text-balance text-4xl font-semibold tracking-[-0.02em] md:text-5xl"
        >
          Three layers. Take only what you need.
        </h2>
        <p className="mt-4 max-w-[58ch] text-lg text-[var(--color-fg-muted)]">
          Stay declarative, swap a single component, or take the source — without ever losing your
          types.
        </p>

        <ul className="mt-14 space-y-5">
          {LAYERS.map((layer) => (
            <li
              key={layer.title}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6 shadow-[var(--shadow-card)] md:p-8"
            >
              <div className="grid gap-x-10 gap-y-4 md:grid-cols-[1fr_1.25fr] md:items-start">
                <div className="min-w-0">
                  <h3 className="text-xl font-semibold tracking-tight">{layer.title}</h3>
                  <p className="mt-2 max-w-[42ch] text-[var(--color-fg-muted)]">
                    {layer.description}
                  </p>
                </div>
                <CodeBlock>{layer.code}</CodeBlock>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
