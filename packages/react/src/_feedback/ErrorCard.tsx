"use client";
import { Card, CardContent, CardHeader } from "../_layout/Card.js";

export function ErrorCard({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <Card className="border-fp-border-danger">
      <CardHeader>Widget failed</CardHeader>
      <CardContent>
        <p className="text-xs text-fp-text-3">{error.message}</p>
        {onRetry ? (
          <button type="button" onClick={onRetry} className="mt-2 text-xs underline">
            Retry
          </button>
        ) : null}
      </CardContent>
    </Card>
  );
}
