import { describe, expect, it } from "vitest";
import { cn } from "../cn";

describe("cn", () => {
  it("lets a later class win a plain Tailwind v3 conflict", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("lets a later class win a Tailwind v4-only conflict", () => {
    expect(cn("inset-shadow-sm", "inset-shadow-md")).toBe("inset-shadow-md");
    expect(cn("inset-ring-1", "inset-ring-2")).toBe("inset-ring-2");
    expect(cn("field-sizing-content", "field-sizing-fixed")).toBe("field-sizing-fixed");
  });
});
