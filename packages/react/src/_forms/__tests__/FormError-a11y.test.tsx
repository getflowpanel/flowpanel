// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FormError } from "../FormError";

// FormError consumes useFormContext. Mock the module to inject errors.
vi.mock("../Form", () => ({
  useFormContext: () => ({ form: { errors: ["Email is required"] } }),
}));

describe("FormError — a11y", () => {
  it("renders as an assertive live region with the first error", () => {
    render(<FormError />);
    const el = screen.getByRole("alert");
    expect(el.getAttribute("aria-live")).toBe("assertive");
    expect(el.textContent).toBe("Email is required");
  });
});
