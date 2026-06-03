import type { PageConfig } from "@flowpanel/core";

/**
 * Render a user-owned page registered via `defineAdmin({ pages: [...] })`.
 *
 * The wrapper just invokes the user's `component` — it accepts either a
 * server component or a client component (with `"use client"`). Standard
 * RSC interop applies; no special bundling is needed on FlowPanel's side.
 *
 * Pages without a `component` are filtered out by `matchPage` and never
 * reach this wrapper.
 */
export function UserPage({ page }: { page: PageConfig }) {
  const Component = page.component;
  if (!Component) return null;
  return <Component />;
}
