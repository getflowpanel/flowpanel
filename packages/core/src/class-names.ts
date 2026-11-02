import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const KIT_PREFIX = "fp-";

// Kit classes carry the `fp-` prefix; read them unprefixed so they conflict with each other and with host classes.
const merge = extendTailwindMerge({
  extend: { theme: { ease: ["spring"] } },
  experimentalParseClassName({ className, parseClassName }) {
    const parsed = parseClassName(className);
    const sign = parsed.baseClassName.startsWith("-") ? "-" : "";
    const name = parsed.baseClassName.slice(sign.length);
    if (!name.startsWith(KIT_PREFIX)) return parsed;
    const postfix = parsed.maybePostfixModifierPosition;
    return {
      ...parsed,
      baseClassName: `${sign}${name.slice(KIT_PREFIX.length)}`,
      maybePostfixModifierPosition: postfix === undefined ? undefined : postfix - KIT_PREFIX.length,
    };
  },
});

/** Joins class names; a later class replaces an earlier one it conflicts with, `fp-` kit classes included. */
export function cn(...inputs: ClassValue[]): string {
  return merge(clsx(inputs));
}
