import { describe, expect, it, vi } from "vitest";
import { buildCommandGroups } from "../CommandHost.js";

describe("buildCommandGroups", () => {
  it("navigates via nav.push when a built-in nav item is selected", () => {
    const push = vi.fn();
    const close = vi.fn();
    const groups = buildCommandGroups([{ label: "Users", href: "/admin/users" }], undefined, {
      push,
      close,
    });
    const navGroup = groups.find((g) => g.label === "Navigation");
    navGroup?.items[0]?.onSelect();
    expect(close).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/admin/users");
  });

  it("navigates via nav.push when a user-defined group item is selected", () => {
    const push = vi.fn();
    const close = vi.fn();
    const groups = buildCommandGroups(
      [],
      {
        groups: [
          {
            label: "Actions",
            items: [
              {
                label: "Open settings",
                icon: "settings",
                action: { type: "navigate", href: "/admin/settings" },
              },
            ],
          },
        ],
      },
      { push, close },
    );
    const actionsGroup = groups.find((g) => g.label === "Actions");
    actionsGroup?.items[0]?.onSelect();
    expect(close).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/admin/settings");
    expect(actionsGroup?.items[0]?.icon).toBeTruthy();
  });

  // `CommandItem["action"]` is now `{ type: "navigate"; href: string }` only —
  // the `run`-with-callback variant was removed because a function declared
  // in the server-rendered admin config can't cross into `CommandHost`, a
  // `"use client"` component. This config type-checks precisely because that
  // variant no longer exists in the type; a regression (re-adding `run`)
  // would need to change this call site too, not just crash at runtime.
  it("omits Navigation/Theme groups when disabled, keeping only user-defined groups", () => {
    const groups = buildCommandGroups(
      [{ label: "Users", href: "/admin/users" }],
      {
        disableNavigation: true,
        disableTheme: true,
        groups: [
          {
            label: "Actions",
            items: [{ label: "Docs", action: { type: "navigate", href: "https://example.com" } }],
          },
        ],
      },
      { push: vi.fn(), close: vi.fn() },
    );
    expect(groups.map((g) => g.label)).toEqual(["Actions"]);
  });

  it("includes a Theme group with a toggle item by default", () => {
    const groups = buildCommandGroups([], undefined, { push: vi.fn(), close: vi.fn() });
    const themeGroup = groups.find((g) => g.label === "Theme");
    expect(themeGroup?.items.map((it) => it.label)).toEqual(["Toggle dark mode"]);
  });
});
