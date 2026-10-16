// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DevAuthNote } from "../runtime/dev-auth-note";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("DevAuthNote", () => {
  it("names the session function, the dev-auth command and the guide", () => {
    vi.stubEnv("npm_config_user_agent", "pnpm/10.33.0 npm/? node/v22.23.2 darwin arm64");
    const { container } = render(<DevAuthNote provider={undefined} />);
    expect(container.textContent).toContain(
      "Development note: auth.session returned no session for this request. Have auth.session in flowpanel.config.ts return your provider's session, or run pnpm flowpanel init --dev-auth to replace the stub init wrote with an open development identity.",
    );
    expect([...container.querySelectorAll("code")].map((code) => code.textContent)).toEqual([
      "auth.session",
      "auth.session",
      "flowpanel.config.ts",
      "pnpm flowpanel init --dev-auth",
      "init",
      "auth.signInUrl",
    ]);
    expect(screen.getByRole("link", { name: "Authentication guide" }).getAttribute("href")).toBe(
      "https://flowpanel.tech/docs/guides/authentication",
    );
  });

  it("names the option that sends a signed-out visitor to the app's sign-in page", () => {
    const { container } = render(<DevAuthNote provider={undefined} />);
    expect(container.textContent).toContain(
      "Set auth.signInUrl to send signed-out visitors to your sign-in page instead of this screen.",
    );
  });

  it("renders a repeated code span without a duplicate key warning", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<DevAuthNote provider={undefined} />);
    expect(error.mock.calls.flat().join(" ")).not.toContain("same key");
    error.mockRestore();
  });

  it("tells a preset's user to sign in through the provider instead of replacing a stub", () => {
    const { container } = render(<DevAuthNote provider="better-auth" />);
    expect(container.textContent).toContain(
      "nobody is signed in to better-auth in this browser. Sign in through your app, then reload this page.",
    );
    expect(container.textContent).not.toContain("init --dev-auth");
  });

  it("names the dev-auth command with the runner of the app's package manager", () => {
    vi.stubEnv("npm_config_user_agent", "npm/10.9.0 node/v22.23.2 darwin arm64");
    const { container } = render(<DevAuthNote provider={undefined} />);
    expect(container.textContent).toContain(
      "or run npx flowpanel init --dev-auth to replace the stub",
    );
  });
});
