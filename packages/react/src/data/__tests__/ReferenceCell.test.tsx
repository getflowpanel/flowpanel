// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ReferenceCell } from "../ReferenceCell";

afterEach(cleanup);

describe("ReferenceCell", () => {
  it("cuts its link to the cell, so a long label never runs under the next column's link", () => {
    render(
      <ReferenceCell
        label="Replacement Ear Pads for Sony WH-1000XM5"
        href="/admin/listings/1036"
      />,
    );
    const link = screen.getByRole("link", { name: "Replacement Ear Pads for Sony WH-1000XM5" });
    expect(link.className).toContain("fp-max-w-full");
    expect(link.className).toContain("fp-truncate");
    expect(link.className).toContain("fp-inline-block");
  });
});
