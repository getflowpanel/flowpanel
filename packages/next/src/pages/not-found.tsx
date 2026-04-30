import { Button, EmptyState } from "@flowpanel/react";

export function NotFound() {
  return (
    <EmptyState
      title="Page not found"
      description="The resource or dashboard you requested doesn't exist."
      action={
        <Button asChild variant="outline">
          <a href="/admin">Back to admin</a>
        </Button>
      }
    />
  );
}
