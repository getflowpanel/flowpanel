// @vitest-environment happy-dom

import { RU_LABELS } from "@flowpanel/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LabelsProvider } from "../../_provider/LabelsContext";
import { ErrorCard } from "../ErrorCard";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

const SQL = 'relation "scraper_run" does not exist: select count(*) from scraper_run';

describe("the card a failed widget leaves behind", () => {
  it("takes its whole copy from the labels", () => {
    render(<ErrorCard error={new Error("boom")} onRetry={() => {}} />);
    expect(screen.getByText("Couldn't load this widget")).toBeTruthy();
    expect(screen.getByText("Its query failed. Retry, or look in the server log.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("names the widget that failed in its header, when the widget has a title", () => {
    render(<ErrorCard error={new Error("boom")} title="Revenue" />);
    expect(screen.getByText("Revenue").className).not.toContain("text-fp-err-text");
    expect(screen.getByText("Couldn't load this widget").className).toContain("text-fp-err-text");
  });

  it("speaks the admin's language", () => {
    render(
      <LabelsProvider value={RU_LABELS}>
        <ErrorCard error={new Error("boom")} onRetry={() => {}} />
      </LabelsProvider>,
    );
    expect(screen.getByText("Не удалось загрузить виджет")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Повторить" })).toBeTruthy();
  });

  it("marks itself as a FlowPanel error surface, saying what failed in the error colour on a neutral card", () => {
    const { container } = render(<ErrorCard error={new Error("boom")} />);
    const card = container.querySelector("[data-fp-error]") as HTMLElement;
    expect(card.className).not.toContain("border-fp-err");
    expect(screen.getByText("Couldn't load this widget").className).toContain("text-fp-err-text");
  });

  it("offers the retry it was given", () => {
    const onRetry = vi.fn();
    render(<ErrorCard error={new Error("boom")} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("keeps the driver's message behind a closed disclosure in development", () => {
    render(<ErrorCard error={new Error(SQL)} />);
    const detail = screen.getByText(SQL);
    const disclosure = detail.closest("details") as HTMLDetailsElement;
    expect(disclosure.open).toBe(false);
    expect(disclosure.querySelector("summary")?.textContent).toBe("Details");
  });

  it("never prints the driver's message in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const { container } = render(<ErrorCard error={new Error(SQL)} />);
    expect(screen.queryByText(SQL)).toBeNull();
    expect(container.querySelector("details")).toBeNull();
    expect(screen.getByText("Couldn't load this widget")).toBeTruthy();
  });
});
