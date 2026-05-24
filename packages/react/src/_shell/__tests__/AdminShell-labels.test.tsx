// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// FlowpanelGlobals mounts RealtimeProvider, which calls useRouter for the
// coalesced refresh. Provide a router stub so these unrelated tests render.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

import { useLabels } from "../../_provider/LabelsContext.js";
import { FlowpanelGlobals } from "../FlowpanelGlobals.js";

afterEach(() => cleanup());

function Probe() {
  const l = useLabels();
  return <p>{l.actions.save}</p>;
}

describe("FlowpanelGlobals — labels prop", () => {
  it("forwards labels into LabelsProvider", () => {
    render(
      <FlowpanelGlobals labels={{ actions: { save: "Сохранить" } }}>
        <Probe />
      </FlowpanelGlobals>,
    );
    expect(screen.getByText("Сохранить")).toBeTruthy();
  });
  it("falls back to default save label without labels prop", () => {
    render(
      <FlowpanelGlobals>
        <Probe />
      </FlowpanelGlobals>,
    );
    expect(screen.getByText("Save")).toBeTruthy();
  });
});
