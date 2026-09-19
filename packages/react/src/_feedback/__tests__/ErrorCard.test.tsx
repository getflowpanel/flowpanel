// @vitest-environment happy-dom

import { RU_LABELS } from "@flowpanel/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LabelsProvider } from "../../_provider/LabelsContext";
import { ErrorCard } from "../ErrorCard";

afterEach(cleanup);

describe("the card a failed widget leaves behind", () => {
  it("takes its whole copy from the labels", () => {
    render(<ErrorCard error={new Error("boom")} onRetry={() => {}} />);
    expect(screen.getByText("Widget failed")).toBeTruthy();
    expect(screen.getByText("Couldn't load this widget.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("speaks the admin's language", () => {
    render(
      <LabelsProvider value={RU_LABELS}>
        <ErrorCard error={new Error("boom")} onRetry={() => {}} />
      </LabelsProvider>,
    );
    expect(screen.getByText("Виджет не загрузился")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Повторить" })).toBeTruthy();
  });

  it("offers the retry it was given", () => {
    const onRetry = vi.fn();
    render(<ErrorCard error={new Error("boom")} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
