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
function isControlFlow(err: unknown): boolean {
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
    <ServerCard className="border-fp-err/40" data-fp-error="">
      <p className="text-sm font-medium text-fp-text-1">
        {formatLabel(labels.errors.queryTitle, {
          resource: site.resource,
          operation: site.operation,
        })}
      </p>
      <p className="mt-2 text-xs text-fp-text-3">{labels.errors.queryHint}</p>
      {detail ? <p className="mt-2 font-mono text-xs text-fp-text-3">{detail}</p> : null}
      <p className="mt-2 text-xs text-fp-text-3">
        {formatLabel(labels.errors.requestId, { id: site.requestId })}
      </p>
    </ServerCard>
  );
}

/**
 * Run one adapter read. A FlowPanel error keeps travelling — the page's auth
 * boundary and the host's own `notFound()` both depend on it — and anything else
 * becomes a card that names the resource and the operation, with the cause in the
 * server log under this request's id.
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
