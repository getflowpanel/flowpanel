"use client";
import { Card, CardContent, CardHeader } from "../_layout/Card";
import { useLabels } from "../_provider/LabelsContext";

/** Fallback card for a widget whose render or query threw; `title` names the widget, `plain` drops the frame inside a `StatStrip`. */
export function ErrorCard({
  error,
  onRetry,
  plain,
  title,
}: {
  error: Error;
  onRetry?: () => void;
  plain?: boolean;
  title?: string;
}) {
  const { errors } = useLabels();
  const detail = process.env.NODE_ENV === "production" ? null : error.message;
  const body = (
    <>
      <CardHeader>
        {title ?? <span className="fp-text-err-ink">{errors.widgetTitle}</span>}
      </CardHeader>
      <CardContent>
        {title ? <p className="fp-text-sm fp-text-err-ink">{errors.widgetTitle}</p> : null}
        <p className="fp-text-xs fp-text-faint">{errors.widgetHint}</p>
        {detail ? (
          <details className="fp-mt-1 fp-text-xs fp-text-faint">
            <summary className="fp-cursor-pointer">{errors.details}</summary>
            <p className="fp-mt-1 fp-break-words fp-font-mono">{detail}</p>
          </details>
        ) : null}
        {onRetry ? (
          <button type="button" onClick={onRetry} className="fp-mt-2 fp-text-xs fp-underline">
            {errors.retry}
          </button>
        ) : null}
      </CardContent>
    </>
  );
  return plain ? (
    <div className="fp-h-full fp-w-full fp-bg-surface" data-fp-error="" data-plain="">
      {body}
    </div>
  ) : (
    <Card className="fp-h-full" data-fp-error="">
      {body}
    </Card>
  );
}
