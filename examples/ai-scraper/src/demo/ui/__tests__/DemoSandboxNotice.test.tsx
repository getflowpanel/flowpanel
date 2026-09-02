import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());

import { DemoSandboxNotice, sandboxNoticeCopy } from "../DemoSandboxNotice";

describe("interactive sandbox notice", () => {
  it("has concise copy for every reset state", () => {
    expect(sandboxNoticeCopy("idle")).toMatch(/private to this browser/i);
    expect(sandboxNoticeCopy("pending")).toMatch(/restoring/i);
    expect(sandboxNoticeCopy("restored")).toMatch(/restored/i);
    expect(sandboxNoticeCopy("rate_limited")).toMatch(/moment/i);
    expect(sandboxNoticeCopy("error")).toMatch(/try again/i);
    expect(sandboxNoticeCopy("idle", true)).toMatch(/editing is temporarily disabled/i);
  });

  it("explains privacy and expiry and exposes an accessible reset control", () => {
    const html = renderToStaticMarkup(<DemoSandboxNotice readOnly={false} />);
    expect(html).toContain("Interactive sandbox");
    expect(html).toContain("Private to this browser");
    expect(html).toContain("60 minutes of inactivity");
    expect(html).toContain("Reset data");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("order-3 w-full");
    expect(html).toContain("sm:order-none sm:w-auto sm:flex-1");
  });

  it("removes the reset control in emergency read-only mode", () => {
    const html = renderToStaticMarkup(<DemoSandboxNotice readOnly />);
    expect(html).toContain("Editing is temporarily disabled");
    expect(html).not.toContain("Reset data");
  });
});
