// @vitest-environment happy-dom

import { cleanup, render, waitFor } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DataTableColumn } from "../data-table-types";
import { useCutColumns } from "../useCutColumns";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

type Row = Record<string, unknown>;
const columns: DataTableColumn<Row>[] = [
  { field: "mrr", type: "number", label: "MRR" },
  { field: "name", type: "string", label: "Name" },
];

function cut(node: Element | null, by: number): void {
  if (!node) return;
  Object.defineProperty(node, "scrollWidth", { configurable: true, value: 100 + by });
  Object.defineProperty(node, "clientWidth", { configurable: true, value: 100 });
}

function Probe({ rows, seen }: { rows: unknown; seen: (raised: Record<string, number>) => void }) {
  const ref = React.useRef<HTMLTableElement>(null);
  const raised = useCutColumns(ref, columns, rows);
  seen(raised);
  return (
    <table ref={ref}>
      <thead>
        <tr>
          <th data-fp-col="mrr">MRR</th>
          <th data-fp-col="name">
            <span className="fp-truncate">Name</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td data-fp-cell="">12,900</td>
          <td data-fp-cell="">Alexandra Montgomery</td>
        </tr>
      </tbody>
    </table>
  );
}

describe("the check after fonts load", () => {
  it("raises a cut header and a cut number, leaves cut text to its ellipsis, and does not loop", async () => {
    vi.stubGlobal("document", Object.assign(document, { fonts: { ready: Promise.resolve() } }));
    const seen = vi.fn();
    const { container, rerender } = render(<Probe rows={1} seen={seen} />);
    cut(container.querySelector("td"), 6);
    cut(container.querySelector("td:nth-child(2)"), 40);
    cut(container.querySelector("th:nth-child(2) .fp-truncate"), 3);
    rerender(<Probe rows={2} seen={seen} />);
    await waitFor(() => expect(seen).toHaveBeenLastCalledWith({ mrr: 6, name: 3 }));
    const renders = seen.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(seen.mock.calls.length).toBe(renders);
  });
});
