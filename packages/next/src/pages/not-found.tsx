import type { ResolvedAdminConfig } from "@flowpanel/core";
import { Button, EmptyState } from "@flowpanel/react";
import { buildHref } from "../runtime/href.js";

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
