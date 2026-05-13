// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AdminShell } from "../AdminShell.js";
import { useLabels } from "../../_provider/LabelsContext.js";

afterEach(() => cleanup());

function Probe() {
  const l = useLabels();
  return <p>{l.actions.save}</p>;
}

describe("AdminShell — labels prop", () => {
  it("forwards labels into LabelsProvider", () => {
    render(
      <AdminShell navGroups={[]} currentPath="/admin" labels={{ actions: { save: "Сохранить" } }}>
        <Probe />
      </AdminShell>,
    );
    expect(screen.getByText("Сохранить")).toBeTruthy();
  });
  it("falls back to default save label without labels prop", () => {
    render(
      <AdminShell navGroups={[]} currentPath="/admin">
        <Probe />
      </AdminShell>,
    );
    expect(screen.getByText("Save")).toBeTruthy();
  });
});
