import { emailParts } from "@flowpanel/core/format";
import { Fragment, type ReactNode } from "react";

/** An email with a line-break chance after "@" and before each dot, so a narrow line wraps it between its parts, not mid-word. */
export function withEmailBreaks(text: string): ReactNode {
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
