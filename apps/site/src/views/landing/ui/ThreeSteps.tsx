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
      "One command detects your ORM, writes a typed config, the /admin page and its routes, and installs the packages.",
    code: (
      <>
        <PromptLine command="pnpm dlx @flowpanel/cli init" />
        {"\n"}
        <OutputLine text="Wrote" />
        {"\n"}
        <OutputLine text="flowpanel.config.ts" />
        {"\n"}
        <OutputLine text="app/admin/[[...slug]]/page.tsx" />
        {"\n"}
        <OutputLine text="app/api/flowpanel/[...route]/route.ts" />
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
    title: "Check it",
    description:
      "One Playwright call opens every page, a record from each list and its tabs, and fails on an error card, a failed request or a console error.",
    code: highlightTs(`await smokeAdmin(page, { basePath: "/admin" })`),
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
          Three steps to a running /admin.
        </h2>
        <p className="mt-4 max-w-[58ch] text-lg text-[var(--color-fg-muted)]">
          FlowPanel reads your Drizzle or Prisma schema, writes one config and scaffolds your /admin
          page.
        </p>

        <ol className="mt-16 space-y-10">
          {STEPS.map((step, i) => (
            <li
              key={step.index}
              className="grid grid-cols-[44px_1fr] gap-x-5 md:grid-cols-[64px_1fr] md:gap-x-8"
            >
              <div className="flex flex-col items-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] font-mono text-sm font-semibold text-[var(--color-fg)] md:h-14 md:w-14 md:text-base">
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
