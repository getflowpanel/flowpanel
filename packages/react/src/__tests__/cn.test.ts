import { describe, expect, it } from "vitest";
import { cn } from "../utils/cn";

describe("cn", () => {
  it("deduplicates conflicting Tailwind classes", () => {
    const result = cn("fp:p-4", "fp:p-2");
    expect(result).toBe("fp:p-2");
  });
});
