import { describe, expect, it } from "vitest";
import { parseCsvRows } from "../internal/csv-rows";

describe("parseCsvRows", () => {
  it("reads quoted fields, doubled quotes, line breaks inside quotes and CRLF", () => {
    const text = '﻿name,note\r\n"Ann, Ltd","said ""hi"""\r\nBob,"two\nlines"\r\n\r\n';
    expect(parseCsvRows(text)).toEqual([
      ["name", "note"],
      ["Ann, Ltd", 'said "hi"'],
      ["Bob", "two\nlines"],
    ]);
  });

  it("keeps a last row without a trailing newline", () => {
    expect(parseCsvRows("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});
