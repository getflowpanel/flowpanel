"use client";
import { Button, PageHeader, useLabels } from "@flowpanel/react";
import { unstable_rethrow, useRouter } from "next/navigation";
import * as React from "react";
import { RequestId } from "../pages/RequestId";
import { FailureCard } from "./failure-card";

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
  /** Drop the fallback card's frame, inside a `StatStrip`. */
  plain?: boolean;
  /** The widget's card title, which the fallback card shows. */
  title?: string;
  /** What failed, in place of "Couldn't load this widget". */
  failureTitle?: string;
  /** Runs before Retry renders the widget again, such as asking for code that failed to load. */
  onRetry?: () => void;
  /** A whole page's heading, kept above the card when the page fails. */
  pageTitle?: string;
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

/** The failed widget's card: its own title, what to do, Retry, and the digest the server log printed. */
function BoundaryFallback({
  error,
  onReset,
  plain,
  title,
  failureTitle,
  pageTitle,
}: {
  error: Error & { digest?: string };
  onReset: () => void;
  plain: boolean;
  title: string | undefined;
  failureTitle: string | undefined;
  pageTitle: string | undefined;
}): React.JSX.Element {
  const router = useRouter();
  const { errors } = useLabels();
  const [pending, startTransition] = React.useTransition();
  const developing = process.env.NODE_ENV !== "production";
  const card = (
    <FailureCard
      {...(title ? { heading: title } : {})}
      title={failureTitle ?? errors.widgetTitle}
      hint={error.digest ? `${errors.widgetHint} ${errors.reportHint}` : errors.widgetHint}
      devHint={
        developing && error.name === "WidgetConnectionFailure" ? errors.connectionHint : null
      }
      detail={developing && error.message ? { summary: errors.details, text: error.message } : null}
      plain={plain}
      actions={
        <>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(() => {
                onReset();
                router.refresh();
              })
            }
          >
            {errors.retry}
          </Button>
          {error.digest ? <RequestId id={error.digest} kind="digest" /> : null}
        </>
      }
    />
  );
  if (!pageTitle) return card;
  return (
    <>
      <PageHeader title={pageTitle} />
      {card}
    </>
  );
}

export class WidgetErrorBoundary extends React.Component<BoundaryProps, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    unstable_rethrow(error);
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
    this.props.onRetry?.();
    this.setState({ error: null });
  };

  override render(): React.ReactNode {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <BoundaryFallback
          error={this.state.error}
          onReset={this.reset}
          plain={this.props.plain === true}
          title={this.props.title}
          failureTitle={this.props.failureTitle}
          pageTitle={this.props.pageTitle}
        />
      );
    }
    return this.props.children;
  }
}
