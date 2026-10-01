// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DevAuthNote } from "../runtime/dev-auth-note";

afterEach(cleanup);

describe("DevAuthNote", () => {
  it("names the session module, the dev-auth command and the guide", () => {
    const { container } = render(<DevAuthNote />);
    expect(container.textContent).toContain(
      "Development note: auth.session returned no session for this request. Connect your provider in the session module init wrote (server/lib/auth.ts by default), or run pnpm flowpanel init --dev-auth to replace an untouched stub with an open development identity.",
    );
    expect([...container.querySelectorAll("code")].map((code) => code.textContent)).toEqual([
      "auth.session",
      "init",
      "server/lib/auth.ts",
      "pnpm flowpanel init --dev-auth",
    ]);
    expect(screen.getByRole("link", { name: "Authentication guide" }).getAttribute("href")).toBe(
      "https://flowpanel.tech/docs/guides/authentication",
    );
  });
});
