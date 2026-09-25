import { describe, expect, it } from "vitest";
import { toneFillClass as fillFromFormat } from "../format-column";
import { toneFillClass, toneTextClass } from "../index";

const TONES = ["accent", "default", "err", "info", "muted", "ok", "warn"];

describe("tone classes", () => {
  it("name a text and a fill class for every tone", () => {
    expect(Object.keys(toneTextClass).sort()).toEqual(TONES);
    expect(Object.keys(toneFillClass).sort()).toEqual(TONES);
    expect(toneTextClass.err).toBe("text-fp-err-text");
    expect(toneFillClass.info).toBe("bg-fp-info");
  });

  it("are read from the format subpath too", () => {
    expect(fillFromFormat.info).toBe("bg-fp-info");
    expect(fillFromFormat).toBe(toneFillClass);
  });
});
