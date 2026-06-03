import { describe, expect, it } from "vitest";
import { rowsToCsv } from "../csv-export.js";
import type { DataTableColumn } from "../data-table-types.js";

type Row = Record<string, unknown>;

describe("rowsToCsv formula-injection protection", () => {
  it("neutralizes a leading '=' with a single-quote prefix", () => {
    const columns: DataTableColumn<Row>[] = [{ field: "expr", label: "Expr" }];
    const csv = rowsToCsv(columns, [{ expr: "=1+1" }]);
    // Body cell is on the line after the header.
    const body = csv.split("\r\n")[1];
    expect(body).toBe("'=1+1");
  });

  it("neutralizes other formula triggers (+ - @)", () => {
    const columns: DataTableColumn<Row>[] = [{ field: "v", label: "V" }];
    expect(rowsToCsv(columns, [{ v: "+2" }]).split("\r\n")[1]).toBe("'+2");
    expect(rowsToCsv(columns, [{ v: "-3" }]).split("\r\n")[1]).toBe("'-3");
    expect(rowsToCsv(columns, [{ v: "@cmd" }]).split("\r\n")[1]).toBe("'@cmd");
  });

  it("neutralizes a leading tab", () => {
    const columns: DataTableColumn<Row>[] = [{ field: "v", label: "V" }];
    expect(rowsToCsv(columns, [{ v: "\tx" }]).split("\r\n")[1]).toBe("'\tx");
  });

  it("applies the quote BEFORE RFC-4180 wrapping when both apply", () => {
    // A value that both triggers a formula AND needs quoting (contains a comma).
    const columns: DataTableColumn<Row>[] = [{ field: "v", label: "V" }];
    const csv = rowsToCsv(columns, [{ v: "=A1,B1" }]);
    // The single quote must sit inside the RFC-4180 quotes.
    expect(csv.split("\r\n")[1]).toBe('"\'=A1,B1"');
  });

  it("leaves safe values untouched", () => {
    const columns: DataTableColumn<Row>[] = [{ field: "v", label: "V" }];
    expect(rowsToCsv(columns, [{ v: "hello" }]).split("\r\n")[1]).toBe("hello");
  });

  it("neutralizes formula triggers in header labels too", () => {
    const columns: DataTableColumn<Row>[] = [{ field: "v", label: "=danger" }];
    const csv = rowsToCsv(columns, [{ v: "ok" }]);
    expect(csv.split("\r\n")[0]).toBe("'=danger");
  });
});
