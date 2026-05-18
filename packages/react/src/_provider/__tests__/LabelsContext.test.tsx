// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_LABELS, formatLabel } from "@flowpanel/core";
import { LabelsProvider, useLabels } from "../LabelsContext.js";

afterEach(() => cleanup());

function SaveLabelProbe() {
  const l = useLabels();
  return <div data-testid="save">{l.actions.save}</div>;
}

function NoResultsProbe() {
  const l = useLabels();
  return <div data-testid="no-results">{l.noResults}</div>;
}

function BulkSelectedProbe({ n }: { n: number }) {
  const l = useLabels();
  return <div data-testid="bulk-selected">{formatLabel(l.bulkBar.selected, { n })}</div>;
}

describe("LabelsContext", () => {
  it("returns DEFAULT_LABELS outside any provider", () => {
    render(<SaveLabelProbe />);
    expect(screen.getByTestId("save").textContent).toBe(DEFAULT_LABELS.actions.save);
  });

  it("LabelsProvider override replaces specified key", () => {
    render(
      <LabelsProvider value={{ actions: { save: "Сохранить" } }}>
        <SaveLabelProbe />
      </LabelsProvider>,
    );
    expect(screen.getByTestId("save").textContent).toBe("Сохранить");
  });

  it("partial override keeps defaults for unset keys", () => {
    render(
      <LabelsProvider value={{ actions: { save: "Sauvegarder" } }}>
        <NoResultsProbe />
        <BulkSelectedProbe n={5} />
      </LabelsProvider>,
    );
    expect(screen.getByTestId("no-results").textContent).toBe("No results");
    expect(screen.getByTestId("bulk-selected").textContent).toBe("5 selected");
  });
});
