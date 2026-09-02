import type { PageConfig } from "@flowpanel/core";

/** Render a user-owned page registered via `defineAdmin({ pages: [...] })`. */
export function UserPage({ page }: { page: PageConfig }) {
  const Component = page.component;
  if (!Component) return null;
  return <Component />;
}
