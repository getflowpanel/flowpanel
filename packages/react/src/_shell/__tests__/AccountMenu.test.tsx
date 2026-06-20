// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { AccountMenu } from "../AccountMenu.js";
import { Brand } from "../Brand.js";

afterEach(cleanup);

describe("Brand", () => {
  it("falls back to Admin when the config names nothing", () => {
    render(<Brand />);
    expect(screen.getByText("Admin")).toBeTruthy();
  });

  it("renders the logo decoratively so the name carries the label", () => {
    const { container } = render(<Brand brand={{ name: "Acme", logo: "/logo.svg" }} />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/logo.svg");
    expect(img?.getAttribute("alt")).toBe("");
  });

  it("links to href when one is configured", () => {
    render(<Brand brand={{ name: "Acme", href: "/" }} />);
    expect(screen.getByRole("link", { name: "Acme" }).getAttribute("href")).toBe("/");
  });

  it("stays unlinked without href", () => {
    render(<Brand brand={{ name: "Acme" }} />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("AccountMenu", () => {
  it("labels the trigger with the name, falling back to the email", () => {
    const { unmount } = render(<AccountMenu user={{ name: "Ada", email: "ada@example.com" }} />);
    expect(screen.getByRole("button", { name: /account menu/i }).textContent).toContain("Ada");
    unmount();
    render(<AccountMenu user={{ email: "ada@example.com" }} />);
    expect(screen.getByRole("button", { name: /account menu/i }).textContent).toContain(
      "ada@example.com",
    );
  });

  it("shows an initial when there is no avatar image", () => {
    const { container } = render(<AccountMenu user={{ name: "ada" }} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("button", { name: /account menu/i }).textContent).toContain("A");
  });

  it("opens items and the sign-out link", async () => {
    const user = userEvent.setup();
    render(
      <AccountMenu
        user={{
          name: "Ada",
          email: "ada@example.com",
          items: [{ label: "Settings", href: "/settings" }],
          signOut: "/sign-out",
        }}
      />,
    );
    await user.click(screen.getByRole("button", { name: /account menu/i }));
    expect(screen.getByRole("menuitem", { name: "Settings" }).getAttribute("href")).toBe(
      "/settings",
    );
    expect(screen.getByRole("menuitem", { name: /sign out/i }).getAttribute("href")).toBe(
      "/sign-out",
    );
  });

  it("renders an item without href as plain text, not a dead link", async () => {
    const user = userEvent.setup();
    render(<AccountMenu user={{ name: "Ada", items: [{ label: "Read only" }] }} />);
    await user.click(screen.getByRole("button", { name: /account menu/i }));
    expect(screen.getByRole("menuitem", { name: "Read only" }).tagName).not.toBe("A");
  });
});
