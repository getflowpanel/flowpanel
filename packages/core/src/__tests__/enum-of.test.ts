import { describe, expect, it } from "vitest";
import { badgeProps, enumOf, formatColumnValue } from "../index";

const Plan = enumOf(["free", "starter", "pro"], {
  free: ["Free", "muted"],
  starter: { label: "Starter", tone: "info" },
  pro: "Pro",
});

describe("enumOf", () => {
  it("keeps declaration order in values and options", () => {
    expect(Plan.values).toEqual(["free", "starter", "pro"]);
    expect(Plan.options).toEqual([
      { label: "Free", value: "free" },
      { label: "Starter", value: "starter" },
      { label: "Pro", value: "pro" },
    ]);
  });

  it("reads the pair, object and string entry forms", () => {
    expect(Plan.labels).toEqual({ free: "Free", starter: "Starter", pro: "Pro" });
    expect(Plan.tones).toEqual({ free: "muted", starter: "info", pro: "default" });
  });

  it("labels, tones and badges a known value", () => {
    expect(Plan.label("starter")).toBe("Starter");
    expect(Plan.tone("free")).toBe("muted");
    expect(Plan.badge("pro")).toEqual({ label: "Pro", tone: "default" });
  });

  it("prints an unknown value as itself and a missing one as a dash", () => {
    expect(Plan.label("legacy")).toBe("legacy");
    expect(Plan.tone("legacy")).toBe("default");
    expect(Plan.badge("legacy")).toEqual({ label: "legacy", tone: "default" });
    expect(Plan.label(null)).toBe("—");
    expect(Plan.label(undefined)).toBe("—");
    expect(Plan.badge(null)).toBeNull();
    expect(Plan.badge(undefined)).toBeNull();
  });

  it("does not read inherited object keys as values", () => {
    expect(Plan.label("toString")).toBe("toString");
    expect(Plan.tone("constructor")).toBe("default");
  });

  it("takes its values from the entries when no list is given", () => {
    const Role = enumOf({ admin: ["Admin", "accent"], user: "User" });
    expect(Role.values).toEqual(["admin", "user"]);
    expect(Role.tone("admin")).toBe("accent");
    expect(Role.options).toEqual([
      { label: "Admin", value: "admin" },
      { label: "User", value: "user" },
    ]);
  });

  it("is a badge column format the list, drawer and detail cells already render", () => {
    expect(Plan.format).toEqual({ kind: "badge", labels: Plan.labels, tones: Plan.tones });
    expect(formatColumnValue("starter", Plan.format)).toBe("Starter");
    expect(badgeProps(Plan.format, "free")).toEqual({
      status: "free",
      label: "Free",
      tone: "muted",
    });
  });
});
