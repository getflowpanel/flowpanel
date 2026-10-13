import type * as React from "react";
import { EMPTY_LINE } from "../lib/label-text";

/** A widget's one-line empty state; a host's block node stays out of a paragraph. */
export function EmptyLine({ children }: { children: React.ReactNode }) {
  const Tag = typeof children === "string" || typeof children === "number" ? "p" : "div";
  return <Tag className={EMPTY_LINE}>{children}</Tag>;
}
