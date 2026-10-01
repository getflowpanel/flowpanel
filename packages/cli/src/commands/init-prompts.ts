import * as p from "@clack/prompts";
import pc from "picocolors";

export const ABORTED = "Aborted — nothing was written.";

export function abortOnCancel<T>(answer: T | symbol): T {
  if (p.isCancel(answer)) {
    p.cancel(ABORTED);
    process.exit(1);
  }
  return answer;
}

interface AskOptions {
  message: string;
  initialValue: string;
  /** The reason the answer cannot be used, or `null` when it can. */
  check?: (answer: string) => Promise<string | null>;
}

/** Asks the same question again, with the reason as its hint, until the answer passes `check`. */
export async function askText({ message, initialValue, check }: AskOptions): Promise<string> {
  let hint: string | null = null;
  let value = initialValue;
  for (;;) {
    const answer: string = abortOnCancel(
      await p.text({
        message: hint ? `${message}\n${pc.gray(p.S_BAR)}  ${pc.red(hint)}` : message,
        initialValue: value,
      }),
    );
    hint = check ? await check(answer) : null;
    if (hint === null) return answer;
    value = answer;
  }
}

export const DEV_AUTH_QUESTION =
  "No session helper found. Use an open development-only admin identity for now?";
export const DEV_AUTH_HINT =
  "Writes a dev stub that refuses to run in production; replace it with your provider before deploying.";

export async function askDevAuth(): Promise<boolean> {
  return abortOnCancel(
    await p.confirm({
      message: `${DEV_AUTH_QUESTION}\n${pc.dim(DEV_AUTH_HINT)}`,
      initialValue: false,
    }),
  );
}

/** True when init will write the session stub: nothing on disk exports `getSession` and the answer is the guessed path. */
export function writesSessionStub(input: {
  detectedAuth: string | null;
  guessedAuth: string;
  answer: string;
}): boolean {
  return input.detectedAuth === null && input.answer === input.guessedAuth;
}

/** The wizard offers the development identity only where it would write the stub and the flag is absent. */
export function shouldAskDevAuth(input: {
  unattended: boolean;
  sessionStub: boolean;
  devAuth: boolean;
}): boolean {
  return !input.unattended && input.sessionStub && !input.devAuth;
}

/** Validates the auth path answer, except the two paths init creates itself (the stub and the preset module). */
export function authAnswerCheck(input: {
  plannedSession: string | null;
  detectedAuth: string | null;
  guessedAuth: string;
  validate: (answer: string) => Promise<string | null>;
}): (answer: string) => Promise<string | null> {
  return (answer) =>
    answer === input.plannedSession ||
    writesSessionStub({
      detectedAuth: input.detectedAuth,
      guessedAuth: input.guessedAuth,
      answer,
    })
      ? Promise.resolve(null)
      : input.validate(answer);
}
