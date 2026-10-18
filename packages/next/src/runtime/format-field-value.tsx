import { emailParts } from "@flowpanel/core/format";
import { LocalTime } from "@flowpanel/react";
import type { ReactNode } from "react";
import { Fragment } from "react";

const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** Render a record field value for KV / detail / drawer display. */
export function formatFieldValue(v: unknown): ReactNode {
  if (v === null || v === undefined || v === "") return "—";
  if (v instanceof Date) return <LocalTime date={v} />;
  if (typeof v === "string" && ISO_DATETIME_RE.test(v)) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return <LocalTime date={v} />;
  }
  if (typeof v === "object") return JSON.stringify(v);
  return withEmailBreaks(String(v));
}

/** An email with a line-break chance after "@" and before each dot, so a narrow drawer wraps it between its parts. */
function withEmailBreaks(text: string): ReactNode {
  const parts = emailParts(text);
  if (!parts) return text;
  let at = 0;
  return parts.map((part) => {
    const start = at;
    at += part.length;
    return start === 0 ? (
      part
    ) : (
      <Fragment key={start}>
        <wbr />
        {part}
      </Fragment>
    );
  });
}
