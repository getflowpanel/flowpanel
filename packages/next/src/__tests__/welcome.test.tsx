// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Welcome } from "../pages/welcome";

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
    expect(commandFor("")).toBe("flowpanel new <table>");
  });
});
