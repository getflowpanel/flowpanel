import { describe, expect, it } from "vitest";
import { activeNavHref } from "../active-nav";

const groups = [
  {
    items: [
      { label: "Overview", href: "/admin" },
      { label: "Orders", href: "/admin/orders" },
      { label: "System", href: "/admin/system" },
    ],
  },
];

describe("activeNavHref", () => {
  it("picks the most specific entry for a page under it", () => {
    expect(activeNavHref(groups, "/admin/orders/42")).toBe("/admin/orders");
  });

  it("marks the root entry on the root page", () => {
    expect(activeNavHref(groups, "/admin")).toBe("/admin");
    expect(activeNavHref(groups, "/admin/")).toBe("/admin");
  });

  it("marks nothing for a page no entry holds, as a 404 is", () => {
    expect(activeNavHref(groups, "/admin/nowhere")).toBeUndefined();
    expect(activeNavHref(groups, "/admin/nowhere/deeper")).toBeUndefined();
  });

  it("still lets a lone root entry hold the pages under it", () => {
    expect(activeNavHref([{ items: [{ label: "Home", href: "/admin" }] }], "/admin/x")).toBe(
      "/admin",
    );
  });

  it("keeps a section entry holding its records when a page sits under it", () => {
    const nested = [
      {
        items: [
          { label: "Overview", href: "/admin" },
          { label: "Users", href: "/admin/users" },
          { label: "Import", href: "/admin/users/import" },
        ],
      },
    ];
    expect(activeNavHref(nested, "/admin/users/42")).toBe("/admin/users");
    expect(activeNavHref(nested, "/admin/users/import")).toBe("/admin/users/import");
    expect(activeNavHref(nested, "/admin/nowhere")).toBeUndefined();
  });
});
