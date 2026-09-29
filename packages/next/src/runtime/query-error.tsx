import type { ResolvedAdminConfig } from "@flowpanel/core";
import { FlowpanelError, formatLabel, mergeLabels } from "@flowpanel/core";
import type * as React from "react";
import { ServerCard } from "./_server-card";

/** Which read failed, in the words the reader of the page already knows. */
export interface QuerySite {
  config: ResolvedAdminConfig;
  /** Resource name as the admin routes it. */
  resource: string;
  /** The adapter call: `list`, `get`. */
  operation: string;
  /** Correlates the card with the `console.error` line. Generated when the context has none. */
  requestId?: string;
}

export type QueryOutcome<T> =
  | { failed: false; value: T }
  | { failed: true; card: React.JSX.Element };

/** Next signals redirect and not-found by throwing; those throws are not failures. */
export function isControlFlow(err: unknown): boolean {
  return typeof (err as { digest?: unknown } | null)?.digest === "string";
}

function causeMessage(err: unknown): string | null {
  if (process.env.NODE_ENV === "production") return null;
  const message = err instanceof Error ? err.message : String(err);
  return message.length > 0 ? message : null;
}

export function QueryErrorCard({
  site,
  cause,
}: {
  site: QuerySite & { requestId: string };
  cause: unknown;
}): React.JSX.Element {
  const labels = mergeLabels(site.config.labels);
  const detail = causeMessage(cause);
  return (
    <ServerCard data-fp-error="">
      <p className="text-sm font-medium text-fp-err-text">
        {formatLabel(labels.errors.queryTitle, {
          resource: site.resource,
          operation: site.operation,
        })}
      </p>
      <p className="mt-2 text-xs text-fp-text-3">{labels.errors.queryHint}</p>
      {detail ? (
        <details className="mt-2 text-xs text-fp-text-3">
          <summary className="cursor-pointer">{labels.errors.details}</summary>
          <p className="mt-1 break-words font-mono">{detail}</p>
        </details>
      ) : null}
      <p className="mt-2 text-xs text-fp-text-3">
        {formatLabel(labels.errors.requestId, { id: site.requestId })}
      </p>
    </ServerCard>
  );
}

/**
 * Runs one adapter read. A FlowPanel error keeps travelling, since the page's auth boundary depends on it.
 * Anything else becomes a card naming the resource and operation, with the cause in the server log.
 */
export async function readOrCard<T>(
  site: QuerySite,
  run: () => Promise<T>,
): Promise<QueryOutcome<T>> {
  try {
    return { failed: false, value: await run() };
  } catch (err) {
    if (err instanceof FlowpanelError || isControlFlow(err)) throw err;
    const requestId = site.requestId ?? crypto.randomUUID();
    console.error(
      `[flowpanel] ${site.resource}: ${site.operation} failed (request ${requestId})`,
      err,
    );
    return { failed: true, card: <QueryErrorCard site={{ ...site, requestId }} cause={err} /> };
  }
}
