// @vitest-environment happy-dom

import { RU_LABELS } from "@flowpanel/core/labels";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

import { LabelsProvider } from "../../provider/LabelsContext";
import { ArrayCell } from "../ArrayCell";
import { renderCellValue } from "../format-cell";
import { InlineEditCell } from "../InlineEditCell";

afterEach(cleanup);

function inRussian(node: ReactNode) {
  return render(<LabelsProvider value={RU_LABELS}>{node}</LabelsProvider>);
}

describe("cells under the ru labels", () => {
  it("name an unformatted boolean in the admin's language", () => {
    const { container } = inRussian(
      <>
        {renderCellValue(true)}
        {renderCellValue(false)}
      </>,
    );
    const words = Array.from(container.querySelectorAll(".fp-sr-only"), (el) => el.textContent);
    expect(words).toEqual([RU_LABELS.filters.yes, RU_LABELS.filters.no]);
  });

  it("name a boolean an inline edit shows", () => {
    inRussian(<InlineEditCell resource="users" id="1" field="active" value valueType="boolean" />);
    expect(screen.getByRole("button").textContent).toContain(RU_LABELS.filters.yes);
  });

  it("read a list cell and its overflow out in the admin's language", () => {
    inRussian(<ArrayCell value={["a", "b", "c", "d"]} max={2} />);
    expect(screen.getByRole("img", { name: "Элементов: 4. a, b, c, d" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "ещё 2" })).toBeTruthy();
  });
});
