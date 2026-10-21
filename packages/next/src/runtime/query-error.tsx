import type { ResolvedAdminConfig } from "@flowpanel/core";
import { FlowpanelError, mergeLabels } from "@flowpanel/core";
import { RefreshButton, RequestId } from "@flowpanel/next/client";
import { unstable_rethrow } from "next/navigation";
import type * as React from "react";
import { logCaught } from "./caught-error";
import { isConnectionError } from "./connection-error";
import { FailureCard } from "./failure-card";
import { fillLabel } from "./resource-title";

/** Which read failed, in the words the reader of the page already knows. */
export interface QuerySite {
  config: ResolvedAdminConfig;
  /** Resource name as the admin routes it, for the server log. */
  resource: string;
  /** The adapter call: `list`, `get`. */
  operation: string;
  /** The resource as the page names it: the plural for a list, the singular for one record. */
  label: string;
  /** One record failed, not a list. */
  record?: boolean;
  /** Correlates the card with the `console.error` line. Generated when the context has none. */
  requestId?: string;
}

export type QueryOutcome<T> =
  | { failed: false; value: T }
  | { failed: true; card: React.JSX.Element };

/** Next signals redirect, not-found and prerender bailouts by throwing; those throws are not failures. */
export function isControlFlow(err: unknown): boolean {
  try {
    unstable_rethrow(err);
    return false;
  } catch {
    return true;
  }
}

function causeMessage(err: unknown): string | null {
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
  const { errors, dateRange } = mergeLabels(site.config.labels);
  const developing = process.env.NODE_ENV !== "production";
  const detail = developing ? causeMessage(cause) : null;
  const title = fillLabel(
    site.record ? errors.loadRecordTitle : errors.loadTitle,
    site.label,
    dateRange.locale,
  );
  return (
    <FailureCard
      title={title}
      hint={`${errors.loadHint} ${errors.reportHint}`}
      devHint={
        developing ? (isConnectionError(cause) ? errors.connectionHint : errors.queryHint) : null
      }
      detail={detail ? { summary: errors.details, text: detail } : null}
      actions={
        <>
          <RefreshButton label={errors.retry} variant="outline" size="sm" />
          <RequestId id={site.requestId} />
        </>
      }
    />
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
    logCaught(`[flowpanel] ${site.resource}: ${site.operation} failed (request ${requestId})`, err);
    // Called, not rendered: the dev renderer serializes a component's props, and `config` holds the database client.
    return { failed: true, card: QueryErrorCard({ site: { ...site, requestId }, cause: err }) };
  }
}
