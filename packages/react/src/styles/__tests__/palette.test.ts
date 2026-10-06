import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/styles/admin.css"), "utf8");

function block(selectorStart: string): Record<string, string> {
  const at = css.indexOf(selectorStart);
  const body = css.slice(css.indexOf("{", at) + 1, css.indexOf("\n}", at));
  const tokens: Record<string, string> = {};
  for (const [, name, value] of body.matchAll(/(--fp-[\w-]+):\s*([^;]+);/g)) {
    tokens[name as string] = (value as string).trim();
  }
  return tokens;
}

const light = block("[data-flowpanel-root],\n[data-flowpanel-portal] {");
const dark = { ...light, ...block('html[data-flowpanel-theme="dark"] [data-flowpanel-root],') };

type Rgb = [number, number, number];

function resolveToken(scheme: Record<string, string>, name: string): string {
  const value = scheme[name];
  if (value === undefined) throw new Error(`${name} is not declared`);
  const alias = /^var\((--fp-[\w-]+)\)$/.exec(value);
  return alias ? resolveToken(scheme, alias[1] as string) : value;
}

function rgb(scheme: Record<string, string>, name: string): Rgb {
  const [h, s, l] = resolveToken(scheme, name)
    .split(/\s+/)
    .map((part) => Number.parseFloat(part)) as [number, number, number];
  const sat = s / 100;
  const lig = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

function over(top: Rgb, alpha: number, bottom: Rgb): Rgb {
  return top.map((c, i) => c * alpha + (bottom[i] as number) * (1 - alpha)) as Rgb;
}

function luminance(color: Rgb): number {
  const [r, g, b] = color.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (r as number) + 0.7152 * (g as number) + 0.0722 * (b as number);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const schemes = { light, dark } as const;
const FOCUS_RING_ALPHA = 0.6;
const SURFACES = ["--fp-bg-1", "--fp-bg-2", "--fp-bg-3"];

describe.each(Object.entries(schemes))("default %s palette", (_, scheme) => {
  it.each(["--fp-text-1", "--fp-text-2", "--fp-text-3"])(
    "%s reads at 4.5:1 on every surface",
    (text) => {
      for (const surface of SURFACES) {
        expect(contrast(rgb(scheme, text), rgb(scheme, surface))).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it.each([
    ["--fp-ok-text", "--fp-ok"],
    ["--fp-warn-text", "--fp-warn"],
    ["--fp-err-text", "--fp-err"],
    ["--fp-info-text", "--fp-info"],
    ["--fp-accent-badge-text", "--fp-accent"],
  ])("%s reads at 4.5:1 on a surface and on its own tint", (text, tone) => {
    for (const surface of SURFACES) {
      const base = rgb(scheme, surface);
      expect(contrast(rgb(scheme, text), base)).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(rgb(scheme, text), over(rgb(scheme, tone), 0.1, base)),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("labels a filled button at 4.5:1", () => {
    expect(
      contrast(rgb(scheme, "--fp-accent-text"), rgb(scheme, "--fp-accent")),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    "--fp-border-2",
    "--fp-data",
    "--fp-ok",
    "--fp-warn",
    "--fp-err",
    "--fp-info",
    "--fp-chart-1",
    "--fp-chart-2",
    "--fp-chart-3",
    "--fp-chart-4",
    "--fp-chart-5",
    "--fp-chart-6",
    "--fp-chart-7",
  ])("%s stands at 3:1 against a surface", (token) => {
    expect(contrast(rgb(scheme, token), rgb(scheme, "--fp-bg-1"))).toBeGreaterThanOrEqual(3);
    expect(contrast(rgb(scheme, token), rgb(scheme, "--fp-bg-2"))).toBeGreaterThanOrEqual(3);
  });

  it.each(["--fp-border-2", "--fp-chart-2"])("%s stands at 3:1 on a fill", (token) => {
    expect(contrast(rgb(scheme, token), rgb(scheme, "--fp-bg-3"))).toBeGreaterThanOrEqual(3);
  });

  it("draws the focus ring at 3:1 against every surface", () => {
    for (const surface of SURFACES) {
      const base = rgb(scheme, surface);
      const ring = over(rgb(scheme, "--fp-ring"), FOCUS_RING_ALPHA, base);
      expect(contrast(ring, base)).toBeGreaterThanOrEqual(3);
    }
  });

  it("paints data in its own colour, not the action colour", () => {
    expect(scheme["--fp-data"]).toBe("var(--fp-chart-1)");
    expect(resolveToken(scheme, "--fp-data")).not.toBe(resolveToken(scheme, "--fp-accent"));
  });

  it("keeps greys neutral", () => {
    for (const name of [...SURFACES, "--fp-border-1", "--fp-text-2", "--fp-text-3"]) {
      const saturation = Number.parseFloat(resolveToken(scheme, name).split(/\s+/)[1] as string);
      expect(saturation).toBeLessThanOrEqual(10);
    }
  });
});

describe("elevation", () => {
  const lum = (scheme: Record<string, string>, name: string) => luminance(rgb(scheme, name));

  it("sets light surfaces on a darker page with fills below both", () => {
    expect(lum(light, "--fp-bg-1")).toBeGreaterThan(lum(light, "--fp-bg-2"));
    expect(lum(light, "--fp-bg-2")).toBeGreaterThan(lum(light, "--fp-bg-3"));
  });

  it("makes the dark page the darkest plane, surfaces one step up and fills above", () => {
    expect(lum(dark, "--fp-bg-2")).toBeLessThan(lum(dark, "--fp-bg-1"));
    expect(lum(dark, "--fp-bg-1")).toBeLessThan(lum(dark, "--fp-bg-3"));
  });
});
