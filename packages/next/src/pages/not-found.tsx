import type { ResolvedAdminConfig } from "@flowpanel/core";
import { Button, EmptyState } from "@flowpanel/react";
import { buildHref } from "../runtime/href.js";

/**
 * 404 page rendered when the catch-all admin handler can't match the
 * URL to a resource, dashboard, or queue. The "back" link respects
 * `config.basePath` so admins mounted at a non-default prefix still
 * navigate back into the admin (not into the surrounding site).
 */
export function NotFound({ config }: { config?: ResolvedAdminConfig }) {
  const backHref = config ? buildHref(config) : "/admin";
  return (
    <EmptyState
      title="Page not found"
      description="The resource or dashboard you requested doesn't exist."
      action={
        <Button asChild variant="outline">
          <a href={backHref}>Back to admin</a>
        </Button>
      }
    />
  );
}
