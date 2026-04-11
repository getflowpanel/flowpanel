import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Badge } from "../components/ui/badge.js";

describe("Badge", () => {
  it("renders with default variant", () => {
    const { getByText } = render(<Badge>Test</Badge>);
    expect(getByText("Test")).toBeDefined();
  });

  it("renders all status variants without error", () => {
    const variants = ["ok", "err", "warn", "running", "muted"] as const;
    for (const variant of variants) {
      const { getByText } = render(<Badge variant={variant}>{variant}</Badge>);
      expect(getByText(variant)).toBeDefined();
    }
  });
});
