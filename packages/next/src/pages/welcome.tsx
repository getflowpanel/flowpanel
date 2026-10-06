import { cliCommand } from "../runtime/cli-command";

const GETTING_STARTED_URL =
  "https://flowpanel.tech/docs/introduction/getting-started#add-your-first-resource";

const SNIPPET = `resource(schema.users, {
  label: "Users",
  columns: ["email", "name", "createdAt"],
}),`;

const BLOCK =
  "w-full max-w-lg overflow-x-auto rounded-fp border border-fp-border-1 bg-fp-bg-2 px-4 py-3 text-left font-mono text-xs text-fp-text-1";
const INLINE = "rounded-fp-sm bg-fp-bg-3 px-1 py-0.5 font-mono text-xs text-fp-text-1";

export function Welcome() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-base font-semibold text-fp-text-1">FlowPanel is mounted</h1>
      <p className="mt-1 text-sm text-fp-text-3">
        <code className={INLINE}>resources</code> is empty. Add the first one:
      </p>
      <pre className={`mt-4 ${BLOCK}`}>
        <code>{cliCommand("new <table>")}</code>
      </pre>
      <p className="mt-6 text-sm text-fp-text-3">
        Or add it to <code className={INLINE}>flowpanel.config.ts</code>:
      </p>
      <pre className={`mt-2 ${BLOCK}`}>
        <code>{SNIPPET}</code>
      </pre>
      <a
        href={GETTING_STARTED_URL}
        className="mt-6 text-sm font-medium text-fp-text-1 underline underline-offset-4 hover:text-fp-text-2"
      >
        See the FlowPanel docs
      </a>
    </div>
  );
}
