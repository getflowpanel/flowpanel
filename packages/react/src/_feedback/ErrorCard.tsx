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
        {title ?? <span className="text-fp-err-text">{errors.widgetTitle}</span>}
      </CardHeader>
      <CardContent>
        {title ? <p className="text-sm text-fp-err-text">{errors.widgetTitle}</p> : null}
        <p className="text-xs text-fp-text-3">{errors.widgetHint}</p>
        {detail ? (
          <details className="mt-1 text-xs text-fp-text-3">
            <summary className="cursor-pointer">{errors.details}</summary>
            <p className="mt-1 break-words font-mono">{detail}</p>
          </details>
        ) : null}
        {onRetry ? (
          <button type="button" onClick={onRetry} className="mt-2 text-xs underline">
            {errors.retry}
          </button>
        ) : null}
      </CardContent>
    </>
  );
  return plain ? (
    <div className="h-full w-full bg-fp-bg-1" data-fp-error="" data-plain="">
      {body}
    </div>
  ) : (
    <Card className="h-full" data-fp-error="">
      {body}
    </Card>
  );
}
