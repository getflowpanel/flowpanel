import { cliCommand } from "./cli-command";

const AUTH_GUIDE_URL = "https://flowpanel.tech/docs/guides/authentication";

export function devAuthNote(): string {
  return `Development note: \`auth.session\` returned no session for this request. Have \`auth.session\` in \`flowpanel.config.ts\` return your provider's session, or run \`${cliCommand("init --dev-auth")}\` to replace the stub \`init\` wrote with an open development identity.`;
}

let warned = false;

/** Warns the sign-in wall's development note once per process. */
export function warnNoSession(): void {
  if (warned) return;
  warned = true;
  console.warn(`[flowpanel] ${devAuthNote()}`);
}

const CODE = "fp-rounded-sm fp-bg-fill fp-px-1 fp-py-0.5 fp-font-mono fp-text-xs fp-text-ink";

function withCode(text: string) {
  return text.split("`").map((part, index) =>
    index % 2 === 1 ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: the same code span can appear twice in one note.
      <code key={index} className={CODE}>
        {part}
      </code>
    ) : (
      part
    ),
  );
}

/** What a developer does next when the sign-in wall shows outside production. */
export function DevAuthNote() {
  return (
    <div
      data-fp-dev-note=""
      className="fp-max-w-md fp-rounded fp-border fp-border-line fp-bg-canvas fp-px-4 fp-py-3 fp-text-left fp-text-sm fp-leading-relaxed fp-text-soft"
    >
      <p>{withCode(devAuthNote())}</p>
      <a
        href={AUTH_GUIDE_URL}
        className="fp-mt-2 fp-inline-block fp-font-medium fp-text-ink fp-underline fp-underline-offset-4 hover:fp-text-soft"
      >
        Authentication guide
      </a>
    </div>
  );
}
