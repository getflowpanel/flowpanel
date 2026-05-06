// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FormSection } from "../FormSection.js";

afterEach(cleanup);

describe("FormSection", () => {
  it("renders label and children", () => {
    render(
      <FormSection label="Profile">
        <input placeholder="name" />
      </FormSection>,
    );
    expect(screen.getByText("Profile")).toBeTruthy();
    expect(screen.getByPlaceholderText("name")).toBeTruthy();
  });

  it("renders optional description when provided", () => {
    render(
      <FormSection label="Billing" description="Payment details">
        <input placeholder="card" />
      </FormSection>,
    );
    expect(screen.getByText("Billing")).toBeTruthy();
    expect(screen.getByText("Payment details")).toBeTruthy();
  });
});
