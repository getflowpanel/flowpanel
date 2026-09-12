import type { ResolvedAdminConfig } from "@flowpanel/core";
import { mergeLabels } from "@flowpanel/core";
import { Button, EmptyState } from "@flowpanel/react";
import Link from "next/link";
import { buildHref } from "../runtime/href";

export function NotFound({ config }: { config?: ResolvedAdminConfig }) {
  const backHref = config ? buildHref(config) : "/admin";
  const { notFound } = mergeLabels(config?.labels);
  return (
    <EmptyState
      title={notFound.title}
      description={notFound.description}
      action={
        <Button asChild variant="outline">
          <Link href={backHref}>{notFound.back}</Link>
        </Button>
      }
    />
  );
}
