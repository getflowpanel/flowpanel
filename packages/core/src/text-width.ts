/** Each glyph's width in em in the admin's sans type, widest first; fitted at 12 and 14 px to system-ui, Arial and Helvetica within half a pixel. */
const SHAPES: ReadonlyArray<readonly [RegExp, number]> = [
  [/\p{Extended_Pictographic}/u, 1.3],
  [/[\u2e80-\u9fff\uac00-\ud7af\uff00-\uffef]/, 1.05],
  [/[mwMWЖШЩМЮЫЪжшщмюыъ@%]/, 1],
  [/[ijlI.,:;'|!]/, 0.26],
  [/[\sftr()[\]]/, 0.33],
  [/[0-9]/, 0.62],
  [/\p{Lu}/u, 0.8],
];
const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** How wide a text runs, in em: multiply by the font size for its width. */
export function textWidthEm(text: string): number {
  let em = 0;
  for (const { segment } of GRAPHEMES.segment(text)) {
    em += SHAPES.find(([shape]) => shape.test(segment))?.[1] ?? 0.58;
  }
  return em;
}
