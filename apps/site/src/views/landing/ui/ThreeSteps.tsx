import { CodeBlock, OutputLine, PromptLine } from "@/shared/ui/code-block";

interface Step {
  index: string;
  title: string;
  description: string;
  code: React.ReactNode;
}

const STEPS: ReadonlyArray<Step> = [
  {
    index: "01",
    title: "Init",
    description: "Detect your ORM, list every model, write a typed config.",
    code: (
      <>
        <PromptLine command="pnpm flowpanel init" />
        {"\n"}
        <OutputLine text="detected prisma · 9 models" />
        {"\n"}
        <OutputLine text="wrote flowpanel.config.ts" />
      </>
    ),
  },
  {
    index: "02",
    title: "Configure",
    description: "Pick the resources you want, add filters, override the column you care about.",
    code: (
      <>
        <span className="text-[var(--color-fg-muted)]">{`defineAdmin({`}</span>
        {"\n  "}
        <span>{`resources: [resource(schema.users, { columns: ["email"] })],`}</span>
        {"\n"}
        <span className="text-[var(--color-fg-muted)]">{`})`}</span>
      </>
    ),
  },
  {
    index: "03",
    title: "Mount",
    description: "One page export, one route handler. The /admin surface is fully typed.",
    code: (
      <>
        <PromptLine command="cat app/admin/[[...slug]]/page.tsx" />
        {"\n"}
        <OutputLine text="export default Flowpanel(config)" />
      </>
    ),
  },
];

export function ThreeSteps() {
  return (
    <section
      aria-labelledby="three-steps-title"
      className="border-b border-[var(--color-border)] py-28 md:py-40"
    >
      <div className="mx-auto max-w-[1120px] px-6">
        <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-fg-muted)]">
          <span aria-hidden className="text-[var(--color-fg-subtle)]">
            ●
          </span>
          <span>01 Getting started</span>
        </p>
        <h2
          id="three-steps-title"
          className="mt-6 text-balance text-4xl font-semibold tracking-tight md:text-5xl"
        >
          Three steps. No scaffolding.
        </h2>
        <p className="mt-5 max-w-[60ch] text-lg text-[var(--color-fg-muted)]">
          flowpanel introspects your schema, writes one config, scaffolds your /admin page.
        </p>

        <ol className="mt-16 space-y-10">
          {STEPS.map((step) => (
            <li
              key={step.index}
              className="grid grid-cols-[64px_1fr] gap-x-6 gap-y-3 md:grid-cols-[120px_1fr] md:gap-x-10"
            >
              <span className="pt-1 font-mono text-sm text-[var(--color-fg-subtle)]">
                {step.index}
              </span>
              <div className="min-w-0">
                <h3 className="text-xl font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-3 max-w-[60ch] text-[var(--color-fg-muted)]">{step.description}</p>
                <div className="mt-5">
                  <CodeBlock>{step.code}</CodeBlock>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
