import { cliCommand } from "../runtime/cli-command";

const GETTING_STARTED_URL =
  "https://flowpanel.tech/docs/introduction/getting-started#add-your-first-resource";

const SNIPPET = `resource(schema.users, {
  label: "Users",
  columns: ["email", "name", "createdAt"],
}),`;

const BLOCK =
  "fp-w-full fp-max-w-lg fp-overflow-x-auto fp-rounded fp-border fp-border-line fp-bg-canvas fp-px-4 fp-py-3 fp-text-left fp-font-mono fp-text-xs fp-text-ink";
const INLINE = "fp-rounded-sm fp-bg-fill fp-px-1 fp-py-0.5 fp-font-mono fp-text-xs fp-text-ink";

export function Welcome() {
  return (
    <div className="fp-flex fp-flex-col fp-items-center fp-justify-center fp-px-4 fp-py-16 fp-text-center">
      <h1 className="fp-text-base fp-font-semibold fp-text-ink">FlowPanel is mounted</h1>
      <p className="fp-mt-1 fp-text-sm fp-text-faint">
        <code className={INLINE}>resources</code> is empty. Add the first one:
      </p>
      <pre className={`fp-mt-4 ${BLOCK}`}>
        <code>{cliCommand("new <table>")}</code>
      </pre>
      <p className="fp-mt-6 fp-text-sm fp-text-faint">
        Or add it to <code className={INLINE}>flowpanel.config.ts</code>:
      </p>
      <pre className={`fp-mt-2 ${BLOCK}`}>
        <code>{SNIPPET}</code>
      </pre>
      <a
        href={GETTING_STARTED_URL}
        className="fp-mt-6 fp-text-sm fp-font-medium fp-text-ink fp-underline fp-underline-offset-4 hover:fp-text-soft"
      >
        See the FlowPanel docs
      </a>
    </div>
  );
}
