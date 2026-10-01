// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Welcome } from "../pages/welcome";

afterEach(cleanup);

describe("the empty admin", () => {
  it("offers the command first, the config snippet second and a real docs link", () => {
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
});
