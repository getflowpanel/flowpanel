import { CodeBlock, highlightTs, OutputLine, PromptLine } from "@/shared/ui/code-block";

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
    description:
      "One command: detect your ORM, install the packages, write a typed config. No manual setup.",
    code: (
      <>
        <PromptLine command="pnpm dlx @flowpanel/cli init" />
        {"\n"}
        <OutputLine text="detected prisma · 9 models" />
        {"\n"}
        <OutputLine text="installed @flowpanel/kit, @flowpanel/cli" />
        {"\n"}
        <OutputLine text="wrote flowpanel.config.ts" />
      </>
    ),
  },
  {
    index: "02",
    title: "Configure",
    description: "Pick the resources you want, add filters, override the column you care about.",
    code: highlightTs(
      `defineAdmin({\n  resources: [resource(schema.users, { columns: ["email"] })],\n})`,
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
        <OutputLine text="export default createFlowpanel(config).page" />
      </>
    ),
  },
];

export function ThreeSteps() {
  return (
    <section
      aria-labelledby="three-steps-title"
      className="border-b border-[var(--color-border)] py-20 md:py-24"
    >
      <div className="mx-auto max-w-[1120px] px-6">
        <h2
          id="three-steps-title"
          className="max-w-[20ch] text-balance text-4xl font-semibold tracking-[-0.02em] md:text-5xl"
        >
          Three steps. No scaffolding.
        </h2>
        <p className="mt-4 max-w-[58ch] text-lg text-[var(--color-fg-muted)]">
          flowpanel introspects your schema, writes one config, scaffolds your /admin page.
        </p>

        <ol className="mt-16 space-y-10">
          {STEPS.map((step, i) => (
            <li
              key={step.index}
              className="grid grid-cols-[44px_1fr] gap-x-5 md:grid-cols-[64px_1fr] md:gap-x-8"
            >
              {/* Number badge + timeline connector. */}
              <div className="flex flex-col items-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)] font-mono text-sm font-semibold text-[var(--color-accent)] md:h-14 md:w-14 md:text-base">
                  {step.index}
                </span>
                {i < STEPS.length - 1 && (
                  <span aria-hidden className="mt-3 w-px flex-1 bg-[var(--color-border)]" />
                )}
              </div>
              <div className="min-w-0 pb-4">
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
