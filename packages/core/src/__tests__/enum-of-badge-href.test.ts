import { describe, expect, it } from "vitest";
import { enumOf } from "../index";

const Lifecycle = enumOf({ active: ["Активный", "ok"], asleep: ["Спит", "warn"] });

describe("EnumDef.badge with href", () => {
  it("links the pill to where the value is listed", () => {
    const href = { resource: "user", filter: { lifecycle: "asleep" } };
    expect(Lifecycle.badge("asleep", { href })).toEqual({ label: "Спит", tone: "warn", href });
  });

  it("stays a plain pill without href, and null for a missing value", () => {
    expect(Lifecycle.badge("active")).toEqual({ label: "Активный", tone: "ok" });
    expect(Lifecycle.badge(null, { href: "/admin/user" })).toBeNull();
  });
});
