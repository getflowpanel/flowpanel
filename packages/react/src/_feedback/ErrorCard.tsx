"use client";
import { Card, CardContent, CardHeader } from "../_layout/Card";
import { useLabels } from "../_provider/LabelsContext";

/** Fallback card for a widget whose render or query threw. */
export function ErrorCard({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  const { errors } = useLabels();
  const detail = process.env.NODE_ENV === "production" ? null : error.message;
  return (
    <Card className="border-fp-err/40">
      <CardHeader>{errors.widgetTitle}</CardHeader>
      <CardContent>
        <p className="text-xs text-fp-text-3">{errors.widgetHint}</p>
        {detail ? <p className="mt-1 text-xs text-fp-text-3">{detail}</p> : null}
        {onRetry ? (
          <button type="button" onClick={onRetry} className="mt-2 text-xs underline">
            {errors.retry}
          </button>
        ) : null}
      </CardContent>
    </Card>
  );
}
