import { describe, it, expect } from "vitest";
import { cn } from "../utils/cn.js";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("fp:flex", "fp:gap-2")).toBe("fp:flex fp:gap-2");
  });

  it("handles conditional classes", () => {
    expect(cn("fp:flex", false && "fp:hidden", "fp:gap-2")).toBe("fp:flex fp:gap-2");
  });

  it("deduplicates conflicting Tailwind classes", () => {
    const result = cn("fp:p-4", "fp:p-2");
    expect(result).toBe("fp:p-2");
  });
});
