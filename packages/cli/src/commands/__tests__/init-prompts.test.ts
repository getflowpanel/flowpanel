import * as p from "@clack/prompts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  askDevAuth,
  askText,
  authAnswerCheck,
  DEV_AUTH_HINT,
  DEV_AUTH_QUESTION,
  shouldAskDevAuth,
  writesSessionStub,
} from "../init-prompts";

vi.mock("@clack/prompts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@clack/prompts")>()),
  text: vi.fn(),
  confirm: vi.fn(),
  cancel: vi.fn(),
  isCancel: (value: unknown) => typeof value === "symbol",
}));

const text = vi.mocked(p.text);
const confirm = vi.mocked(p.confirm);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("askText", () => {
  it("returns the first answer when it passes the check", async () => {
    text.mockResolvedValueOnce("@/db/index");
    const check = vi.fn().mockResolvedValue(null);
    expect(await askText({ message: "db", initialValue: "@/db", check })).toBe("@/db/index");
    expect(text).toHaveBeenCalledTimes(1);
    expect(check).toHaveBeenCalledWith("@/db/index");
  });

  it("asks the same question again with the reason as its hint and the last answer prefilled", async () => {
    text.mockResolvedValueOnce("@/lib/database").mockResolvedValueOnce("@/db/index");
    const check = vi
      .fn()
      .mockResolvedValueOnce('Cannot resolve "@/lib/database".')
      .mockResolvedValueOnce(null);
    expect(await askText({ message: "Drizzle db client path", initialValue: "@/db", check })).toBe(
      "@/db/index",
    );
    expect(text).toHaveBeenCalledTimes(2);
    const [first, second] = text.mock.calls.map(([options]) => options);
    expect(first).toMatchObject({ message: "Drizzle db client path", initialValue: "@/db" });
    expect(second?.message).toContain("Drizzle db client path\n");
    expect(second?.message).toContain('Cannot resolve "@/lib/database".');
    expect(second?.initialValue).toBe("@/lib/database");
  });

  it("aborts without writing when the prompt is cancelled", async () => {
    text.mockResolvedValueOnce(p.CANCEL_SYMBOL);
    const exit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("exit");
    }) as never);
    await expect(askText({ message: "db", initialValue: "" })).rejects.toThrow("exit");
    expect(vi.mocked(p.cancel)).toHaveBeenCalledWith("Aborted — nothing was written.");
    expect(exit).toHaveBeenCalledWith(1);
    exit.mockRestore();
  });
});

describe("askDevAuth", () => {
  it("defaults to No and says what the stub does", async () => {
    confirm.mockResolvedValueOnce(true);
    expect(await askDevAuth()).toBe(true);
    const options = confirm.mock.calls[0]?.[0];
    expect(options?.initialValue).toBe(false);
    expect(options?.message).toContain(DEV_AUTH_QUESTION);
    expect(options?.message).toContain(DEV_AUTH_HINT);
  });

  it("asks the question the wizard documents", () => {
    expect(DEV_AUTH_QUESTION).toBe(
      "No session helper found. Use an open development-only admin identity for now?",
    );
    expect(DEV_AUTH_HINT).toBe(
      "Writes a dev stub that refuses to run in production; replace it with your provider before deploying.",
    );
  });
});

describe("writesSessionStub", () => {
  it("is true only when nothing exports getSession and the answer is the guessed path", () => {
    const guessedAuth = "@/server/lib/auth";
    expect(writesSessionStub({ detectedAuth: null, guessedAuth, answer: guessedAuth })).toBe(true);
    expect(writesSessionStub({ detectedAuth: null, guessedAuth, answer: "@/lib/session" })).toBe(
      false,
    );
    expect(writesSessionStub({ detectedAuth: guessedAuth, guessedAuth, answer: guessedAuth })).toBe(
      false,
    );
  });
});

describe("shouldAskDevAuth", () => {
  it("asks only in the interactive flow, where the stub is written and the flag is absent", () => {
    const base = { unattended: false, sessionStub: true, devAuth: false };
    expect(shouldAskDevAuth(base)).toBe(true);
    expect(shouldAskDevAuth({ ...base, unattended: true })).toBe(false);
    expect(shouldAskDevAuth({ ...base, sessionStub: false })).toBe(false);
    expect(shouldAskDevAuth({ ...base, devAuth: true })).toBe(false);
  });
});

describe("authAnswerCheck", () => {
  const validate = vi.fn(async (answer: string) => `bad ${answer}`);
  const check = authAnswerCheck({
    plannedSession: "@/server/lib/flowpanel-session",
    detectedAuth: null,
    guessedAuth: "@/server/lib/auth",
    validate,
  });

  beforeEach(() => validate.mockClear());

  it("lets through the stub path and the planned preset module without validating them", async () => {
    expect(await check("@/server/lib/auth")).toBeNull();
    expect(await check("@/server/lib/flowpanel-session")).toBeNull();
    expect(validate).not.toHaveBeenCalled();
  });

  it("validates any other answer and returns the reason", async () => {
    expect(await check("@/lib/session")).toBe("bad @/lib/session");
    expect(validate).toHaveBeenCalledWith("@/lib/session");
  });

  it("validates the guessed path when a real helper was detected", async () => {
    const detected = authAnswerCheck({
      plannedSession: null,
      detectedAuth: "@/server/lib/auth",
      guessedAuth: "@/server/lib/auth",
      validate,
    });
    expect(await detected("@/server/lib/auth")).toBe("bad @/server/lib/auth");
  });
});
