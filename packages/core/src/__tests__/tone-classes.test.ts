import { describe, expect, it } from "vitest";
import { toneFillClass as fillFromFormat } from "../format-column";
import { toneFillClass, toneTextClass } from "../index";

const TONES = ["accent", "default", "err", "info", "muted", "ok", "warn"];

describe("tone classes", () => {
  it("name a text and a fill class for every tone", () => {
    expect(Object.keys(toneTextClass).sort()).toEqual(TONES);
    expect(Object.keys(toneFillClass).sort()).toEqual(TONES);
    expect(toneTextClass.err).toBe("fp-text-err-ink");
    expect(toneFillClass.info).toBe("fp-bg-info");
  });

  it("are read from the format subpath too", () => {
    expect(fillFromFormat.info).toBe("fp-bg-info");
    expect(fillFromFormat).toBe(toneFillClass);
  });
});
