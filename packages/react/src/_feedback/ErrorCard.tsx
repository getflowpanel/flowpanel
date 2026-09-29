"use client";
import { Card, CardContent, CardHeader } from "../_layout/Card";
import { useLabels } from "../_provider/LabelsContext";

/** Fallback card for a widget whose render or query threw; `plain` drops its frame inside a `StatStrip`. */
export function ErrorCard({
  error,
  onRetry,
  plain,
}: {
  error: Error;
  onRetry?: () => void;
  plain?: boolean;
}) {
  const { errors } = useLabels();
  const detail = process.env.NODE_ENV === "production" ? null : error.message;
  const body = (
    <>
      <CardHeader>
        <span className="text-fp-err-text">{errors.widgetTitle}</span>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-fp-text-3">{errors.widgetHint}</p>
        {detail ? <p className="mt-1 text-xs text-fp-text-3">{detail}</p> : null}
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
