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
  /** Identifier of the widget this boundary wraps. */
  widgetId?: string;
  /** Dashboard slug — same purpose as `widgetId`, lifted one level up. */
  dashboardId?: string;
}

interface SentryLike {
  captureException(error: unknown, hint?: unknown): void;
  withScope(callback: (scope: { setTag(k: string, v: string): void }) => void): void;
}

function getSentry(): SentryLike | null {
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

/** Functional fallback rendered when the boundary caught an error. */
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
