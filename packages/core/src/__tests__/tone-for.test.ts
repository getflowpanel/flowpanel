import { describe, expect, it } from "vitest";
import { toneFor } from "../tone-for";

describe("toneFor", () => {
  const errors = { warn: 0.3, err: 0.5 };
  const success = { warn: 0.9, err: 0.8 };

  it("reads a lower-is-better rate, band edges included", () => {
    expect(toneFor(0.29, errors)).toBe("ok");
    expect(toneFor(0.3, errors)).toBe("warn");
    expect(toneFor(0.49, errors)).toBe("warn");
    expect(toneFor(0.5, errors)).toBe("err");
  });

  it("reads a higher-is-better rate", () => {
    expect(toneFor(0.95, success)).toBe("ok");
    expect(toneFor(0.9, success)).toBe("warn");
    expect(toneFor(0.85, success)).toBe("warn");
    expect(toneFor(0.8, success)).toBe("err");
  });

  it("reads a success rate from its numbers alone", () => {
    const rate = { warn: 95, err: 90 };
    expect(toneFor(97, rate)).toBe("ok");
    expect(toneFor(95, rate)).toBe("warn");
    expect(toneFor(90, rate)).toBe("err");
  });

  it("follows the card's goodWhen only when warn equals err", () => {
    expect(toneFor(5, { warn: 5, err: 5 })).toBe("err");
    expect(toneFor(6, { warn: 5, err: 5 })).toBe("ok");
    expect(toneFor(6, { warn: 5, err: 5 }, undefined, "down")).toBe("err");
    expect(toneFor(0.95, success, undefined, "down")).toBe("ok");
  });

  it("mutes a missing value and too few observations", () => {
    expect(toneFor(null, errors)).toBe("muted");
    expect(toneFor(Number.NaN, errors)).toBe("muted");
    expect(toneFor(0.9, { ...errors, min: 20 }, 10)).toBe("muted");
    expect(toneFor(0.9, { ...errors, min: 20 }, 20)).toBe("err");
    expect(toneFor(0.9, { ...errors, min: 20 })).toBe("err");
  });
});
