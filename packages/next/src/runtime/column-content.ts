import { textWidthEm } from "@flowpanel/core/format";
import { isValidElement, type ReactNode } from "react";

const EMAIL = /e-?mail/i;
const LINK = /(?:url|link|website|homepage|href)$/i;
const LONG_TEXT =
  /(?:description|body|content|text|notes?|summary|message|comment|bio|details|address|subject|title)$/i;

/** What a text column holds, read from its field name on the server so the browser sizes it without the patterns. */
export function columnContent(field: string): "long" | "email" | "link" | undefined {
  if (LINK.test(field)) return "link";
  if (EMAIL.test(field)) return "email";
  return LONG_TEXT.test(field) ? "long" : undefined;
}

const MOST_REM = 24;

/** The text a server-rendered cell shows, read from its elements' children. */
export function cellText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(cellText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return cellText(node.props.children);
  return "";
}

/** About how wide a text runs in the table's 14 px type, in rem. */
export function textRem(text: string): number {
  return (textWidthEm(text.trim()) * 14) / 16;
}

/** The widest of a column's values in rem, a quarter rem up and capped, so the table can give it room. */
export function widestRem(rems: Iterable<number>): number | undefined {
  const widest = Math.max(0, ...rems);
  return widest === 0 ? undefined : Math.min(Math.ceil(widest * 4) / 4, MOST_REM);
}
