import { namedColorHex } from "./css-named-colors";

type Rgb = readonly [r: number, g: number, b: number];

const TRIPLET = /^(-?[\d.]+)(?:deg)?\s+([\d.]+)%\s+([\d.]+)%$/;
const FUNCTION = /^(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*([^)]*)\)$/i;

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));
const toGamma = (c: number): number =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
const toLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** One channel: a number, a percentage of `full`, or `none`. */
function channel(token: string | undefined, full: number): number {
  if (token === undefined || token === "none") return 0;
  return token.endsWith("%") ? (Number.parseFloat(token) / 100) * full : Number.parseFloat(token);
}

function hue(token: string | undefined): number {
  if (token === undefined || token === "none") return 0;
  const n = Number.parseFloat(token);
  if (token.endsWith("turn")) return n * 360;
  if (token.endsWith("rad")) return (n * 180) / Math.PI;
  return n;
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)];
}

function oklabToRgb(l: number, a: number, b: number): Rgb {
  const l1 = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m1 = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s1 = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    toGamma(4.0767416621 * l1 - 3.3077115913 * m1 + 0.2309699292 * s1),
    toGamma(-1.2684380046 * l1 + 2.6097574011 * m1 - 0.3413193965 * s1),
    toGamma(-0.0041960863 * l1 - 0.7034186147 * m1 + 1.707614701 * s1),
  ];
}

function labToRgb(l: number, a: number, b: number): Rgb {
  const fy = (l + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const e = 216 / 24389;
  const k = 24389 / 27;
  const xr = fx ** 3 > e ? fx ** 3 : (116 * fx - 16) / k;
  const yr = l > k * e ? fy ** 3 : l / k;
  const zr = fz ** 3 > e ? fz ** 3 : (116 * fz - 16) / k;
  const [x, y, z] = [xr * 0.96422, yr, zr * 0.82521];
  const xd = 0.9554734527 * x - 0.0230985368 * y + 0.0632593086 * z;
  const yd = -0.0283697093 * x + 1.009995458 * y + 0.021041399 * z;
  const zd = 0.0123140017 * x - 0.0205076964 * y + 1.3303659366 * z;
  return [
    toGamma(3.2409699419 * xd - 1.5373831776 * yd - 0.4986107603 * zd),
    toGamma(-0.9692436363 * xd + 1.8759675015 * yd + 0.0415550574 * zd),
    toGamma(0.0556300797 * xd - 0.2039769589 * yd + 1.0569715142 * zd),
  ];
}

function polar(c: number, h: number): [number, number] {
  const radians = (h * Math.PI) / 180;
  return [c * Math.cos(radians), c * Math.sin(radians)];
}

function hexToRgb(value: string): Rgb | null {
  const hex = value.slice(1);
  if (!/^(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(hex)) return null;
  const full = hex.length <= 4 ? [...hex].map((digit) => digit + digit).join("") : hex;
  const byte = (at: number) => Number.parseInt(full.slice(at, at + 2), 16) / 255;
  return [byte(0), byte(2), byte(4)];
}

function functionToRgb(name: string, args: string): Rgb | null {
  const [main = ""] = args.split("/");
  const parts = main.replace(/,/g, " ").trim().split(/\s+/).slice(0, 3);
  if (parts.length !== 3) return null;
  const [p, q, r] = parts;
  switch (name) {
    case "rgb":
    case "rgba":
      return [channel(p, 255) / 255, channel(q, 255) / 255, channel(r, 255) / 255];
    case "hsl":
    case "hsla":
      return hslToRgb(hue(p), channel(q, 100) / 100, channel(r, 100) / 100);
    case "hwb": {
      const white = channel(q, 100) / 100;
      const black = channel(r, 100) / 100;
      if (white + black >= 1) {
        const grey = white / (white + black);
        return [grey, grey, grey];
      }
      const [red, green, blue] = hslToRgb(hue(p), 1, 0.5);
      const mix = (c: number) => c * (1 - white - black) + white;
      return [mix(red), mix(green), mix(blue)];
    }
    case "lab":
      return labToRgb(channel(p, 100), channel(q, 125), channel(r, 125));
    case "lch":
      return labToRgb(channel(p, 100), ...polar(channel(q, 150), hue(r)));
    case "oklab":
      return oklabToRgb(channel(p, 1), channel(q, 0.4), channel(r, 0.4));
    case "oklch":
      return oklabToRgb(channel(p, 1), ...polar(channel(q, 0.4), hue(r)));
    default:
      return null;
  }
}

function toRgb(value: string): Rgb | null {
  const text = value.trim().toLowerCase();
  const named = /^[a-z]+$/.test(text) ? namedColorHex(text) : undefined;
  if (named) return hexToRgb(`#${named}`);
  if (text.startsWith("#")) return hexToRgb(text);
  const call = FUNCTION.exec(text);
  if (!call) return null;
  const rgb = functionToRgb(call[1] ?? "", call[2] ?? "");
  return rgb?.every(Number.isFinite) ? rgb : null;
}

const round = (n: number, digits = 1): number => Number(n.toFixed(digits));

/** Any CSS colour (hex, a name or a colour function) as the HSL triplet tokens hold, else `null`. */
export function hslTriplet(value: string): string | null {
  const text = value.trim();
  if (TRIPLET.test(text)) return text;
  const rgb = toRgb(text);
  if (!rgb) return null;
  const [r, g, b] = [clamp01(rgb[0]), clamp01(rgb[1]), clamp01(rgb[2])];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return `${round((h * 60 + 360) % 360)} ${round(s * 100)}% ${round(l * 100)}%`;
}

/** WCAG contrast ratio of two HSL triplets, or `null` when either is not one. */
export function contrastRatio(first: string, second: string): number | null {
  const luminance = (triplet: string): number | null => {
    const match = TRIPLET.exec(triplet.trim());
    if (!match) return null;
    const [r, g, b] = hslToRgb(Number(match[1]), Number(match[2]) / 100, Number(match[3]) / 100);
    return (
      0.2126 * toLinear(clamp01(r)) + 0.7152 * toLinear(clamp01(g)) + 0.0722 * toLinear(clamp01(b))
    );
  };
  const a = luminance(first);
  const b = luminance(second);
  if (a === null || b === null) return null;
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
