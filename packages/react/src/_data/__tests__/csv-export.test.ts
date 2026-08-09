import { describe, expect, it } from "vitest";
import { rowsToCsv, rowsToJson } from "../csv-export.js";
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

describe("field-less columns", () => {
  it("keeps a synthetic `__cell_<i>` column out of the CSV entirely", () => {
    const columns: DataTableColumn<Row>[] = [
      { field: "name", label: "Name" },
      { field: "__cell_1", label: "Actions" },
    ];
    const csv = rowsToCsv(columns, [{ name: "Alice" }]);
    expect(csv.split("\r\n")).toEqual(["Name", "Alice"]);
  });

  it("keeps a synthetic `__cell_<i>` column out of the JSON entirely", () => {
    const columns: DataTableColumn<Row>[] = [
      { field: "name", label: "Name" },
      { field: "__cell_0", label: "Actions" },
    ];
    const json = rowsToJson(columns, [{ name: "Alice" }]);
    expect(JSON.parse(json)).toEqual([{ name: "Alice" }]);
  });

  it("exports a real field whose name merely starts with an underscore", () => {
    const columns: DataTableColumn<Row>[] = [{ field: "__cell_kind", label: "Cell kind" }];
    const json = rowsToJson(columns, [{ __cell_kind: "battery" }]);
    expect(JSON.parse(json)).toEqual([{ __cell_kind: "battery" }]);
  });
});

describe("rowsToJson", () => {
  it("emits one object per row, keyed by field, restricted to the given columns", () => {
    const columns: DataTableColumn<Row>[] = [{ field: "name", label: "Name" }];
    const json = rowsToJson(columns, [
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ]);
    expect(JSON.parse(json)).toEqual([{ name: "Alice" }, { name: "Bob" }]);
  });

  it("keeps raw values (numbers stay numbers) rather than display-formatted strings", () => {
    const columns: DataTableColumn<Row>[] = [{ field: "age", label: "Age" }];
    const json = rowsToJson(columns, [{ age: 30 }]);
    expect(JSON.parse(json)).toEqual([{ age: 30 }]);
  });

  it("normalizes missing values to null", () => {
    const columns: DataTableColumn<Row>[] = [{ field: "missing", label: "Missing" }];
    const json = rowsToJson(columns, [{}]);
    expect(JSON.parse(json)).toEqual([{ missing: null }]);
  });
});
