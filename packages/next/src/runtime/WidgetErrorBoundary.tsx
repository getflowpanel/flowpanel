"use client";
import { ErrorCard } from "@flowpanel/react";
import { useRouter } from "next/navigation";
import * as React from "react";

interface State {
  error: Error | null;
}

interface BoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  /**
   * Identifier of the widget this boundary wraps. Surfaces in error
   * telemetry (Sentry tag) and gives the user a hint about which card
   * crashed when multiple are on the same dashboard.
   */
  widgetId?: string;
  /** Dashboard slug — same purpose as `widgetId`, lifted one level up. */
  dashboardId?: string;
}

interface SentryLike {
  captureException(error: unknown, hint?: unknown): void;
  withScope(callback: (scope: { setTag(k: string, v: string): void }) => void): void;
}

function getSentry(): SentryLike | null {
  // Sentry is an optional peer integration — hosts that wire it ship
  // `window.Sentry`, hosts that don't get a graceful no-op. We avoid a
  // direct import so `@flowpanel/next` doesn't drag in @sentry/* as a
  // hard dependency.
  const candidate = (globalThis as { Sentry?: unknown }).Sentry;
  if (
    candidate &&
    typeof candidate === "object" &&
    typeof (candidate as SentryLike).captureException === "function"
  ) {
    return candidate as SentryLike;
  }
  return null;
}

/**
 * Functional fallback rendered when the boundary caught an error.
 * Splits out so we can use `useRouter` (hook, requires function component)
 * for the retry path while the boundary itself stays a class — only class
 * components can implement `getDerivedStateFromError`.
 */
function BoundaryFallback({
  error,
  onReset,
}: {
  error: Error;
  onReset: () => void;
}): React.JSX.Element {
  const router = useRouter();
  const handleRetry = React.useCallback(() => {
    onReset();
    router.refresh();
  }, [onReset, router]);
  return <ErrorCard error={error} onRetry={handleRetry} />;
}

/**
 * Per-widget error boundary used by FlowPanel runtime to isolate one
 * widget's failure from the rest of the dashboard. A SQL error in a
 * single card no longer torpedoes its 3 neighbours.
 *
 * Telemetry. When `widgetId` / `dashboardId` are passed and a global
 * Sentry SDK is available on `globalThis.Sentry`, the boundary tags the
 * captured exception with both. Hosts without Sentry get a no-op.
 *
 * Recovery. The default fallback renders an `<ErrorCard>` with a "Retry"
 * action that clears the boundary state and calls `router.refresh()`,
 * which re-runs the widget's server query without a full page reload.
 */
export class WidgetErrorBoundary extends React.Component<BoundaryProps, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error): void {
    const sentry = getSentry();
    if (!sentry) return;
    const { widgetId, dashboardId } = this.props;
    sentry.withScope((scope) => {
      if (widgetId) scope.setTag("widget.id", widgetId);
      if (dashboardId) scope.setTag("dashboard.id", dashboardId);
      sentry.captureException(error);
    });
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  override render(): React.ReactNode {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return <BoundaryFallback error={this.state.error} onReset={this.reset} />;
    }
    return this.props.children;
  }
}
