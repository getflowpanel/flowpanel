// @vitest-environment happy-dom

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Welcome } from "../pages/welcome";
import { cliCommand } from "../runtime/cli-command";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("the empty admin", () => {
  it("offers the command first, the config snippet second and a real docs link", () => {
    vi.stubEnv("npm_config_user_agent", "pnpm/10.33.0 npm/? node/v22.23.2 darwin arm64");
    const { container } = render(<Welcome />);
    expect(screen.getByRole("heading", { name: "FlowPanel is mounted" })).toBeTruthy();
    expect(container.textContent).toContain("resources is empty. Add the first one:");
    const blocks = [...container.querySelectorAll("pre code")].map((code) => code.textContent);
    expect(blocks[0]).toBe("pnpm flowpanel new <table>");
    expect(blocks[1]).toContain("resource(schema.users, {");
    expect(screen.getByRole("link", { name: "See the FlowPanel docs" }).getAttribute("href")).toBe(
      "https://flowpanel.tech/docs/introduction/getting-started#add-your-first-resource",
    );
  });

  it("writes the command for the package manager that started the server", () => {
    const commandFor = (agent: string) => {
      vi.stubEnv("npm_config_user_agent", agent);
      const { container } = render(<Welcome />);
      const text = container.querySelector("pre code")?.textContent;
      cleanup();
      return text;
    };
    expect(commandFor("npm/10.9.0 node/v22.23.2 darwin arm64")).toBe("npx flowpanel new <table>");
    expect(commandFor("yarn/4.5.0 npm/? node/v22.23.2")).toBe("yarn flowpanel new <table>");
    expect(commandFor("bun/1.2.0 npm/? node/v22.23.2")).toBe("bunx flowpanel new <table>");
    expect(commandFor("")).toBe("npx flowpanel new <table>");
  });
});

describe("the CLI command a hint shows", () => {
  const project = (files: Record<string, string>) => {
    const dir = mkdtempSync(join(tmpdir(), "fp-cli-command-"));
    for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
    return dir;
  };

  it("follows the project when the server was started without a package manager", () => {
    vi.stubEnv("npm_config_user_agent", "");
    expect(cliCommand("new <table>", project({ "pnpm-lock.yaml": "" }))).toBe(
      "pnpm flowpanel new <table>",
    );
    expect(cliCommand("new <table>", project({ "bun.lock": "" }))).toBe(
      "bunx flowpanel new <table>",
    );
    expect(
      cliCommand("new <table>", project({ "package.json": '{"packageManager":"yarn@4.5.0"}' })),
    ).toBe("yarn flowpanel new <table>");
  });

  it("prefers the project's lockfile to the agent, and the agent between two lockfiles", () => {
    vi.stubEnv("npm_config_user_agent", "npm/10.9.0 node/v22.23.2");
    expect(cliCommand("doctor", project({ "pnpm-lock.yaml": "" }))).toBe("pnpm flowpanel doctor");
    vi.stubEnv("npm_config_user_agent", "yarn/4.5.0 npm/? node/v22.23.2");
    expect(cliCommand("doctor", project({ "yarn.lock": "", "package-lock.json": "" }))).toBe(
      "yarn flowpanel doctor",
    );
  });
});
