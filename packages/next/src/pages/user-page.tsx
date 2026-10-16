import type { PageConfig, PageProps, RequestContext, ResolvedAdminConfig } from "@flowpanel/core";
import { mergeLabels, resolveFormatting } from "@flowpanel/core";
import { WidgetErrorBoundary } from "@flowpanel/next/client";
import { SkeletonCard } from "@flowpanel/react";
import { Suspense } from "react";
import { fillLabel } from "../runtime/resource-title";

const CLIENT_REFERENCE = Symbol.for("react.client.reference");

/** A `"use client"` component reaches the server as a reference; its props are serialised into the page. */
function isClientReference(component: unknown): boolean {
  return Reflect.get(Object(component), "$$typeof") === CLIENT_REFERENCE;
}

/** Render a user-owned page registered via `defineAdmin({ pages: [...] })`, with its request and a failure card of its own. */
export function UserPage({
  page,
  config,
  reqCtx,
  searchParams,
}: {
  page: PageConfig;
  config: ResolvedAdminConfig;
  reqCtx: RequestContext;
  searchParams: URLSearchParams;
}) {
  const Component = page.component;
  if (!Component) return null;
  const labels = mergeLabels(config.labels);
  const server = !isClientReference(Component);
  const props: PageProps = {
    session: server ? reqCtx.session : null,
    role: reqCtx.role,
    scope: server ? reqCtx.scope : null,
    formatting: resolveFormatting(config.formatting),
    labels,
    searchParams: Object.fromEntries(searchParams),
  };
  return (
    <WidgetErrorBoundary
      widgetId={`page:${page.path}`}
      title={page.label}
      failureTitle={fillLabel(labels.errors.loadTitle, page.label, labels.dateRange.locale)}
    >
      <Suspense fallback={<SkeletonCard />}>
        <Component {...props} />
      </Suspense>
    </WidgetErrorBoundary>
  );
}
