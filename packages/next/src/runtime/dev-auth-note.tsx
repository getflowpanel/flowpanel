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

const CODE = "rounded-fp-sm bg-fp-bg-3 px-1 py-0.5 font-mono text-xs text-fp-text-1";

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
      className="max-w-md rounded-fp border border-fp-border-1 bg-fp-bg-2 px-4 py-3 text-left text-sm leading-relaxed text-fp-text-2"
    >
      <p>{withCode(devAuthNote())}</p>
      <a
        href={AUTH_GUIDE_URL}
        className="mt-2 inline-block font-medium text-fp-text-1 underline underline-offset-4 hover:text-fp-text-2"
      >
        Authentication guide
      </a>
    </div>
  );
}
