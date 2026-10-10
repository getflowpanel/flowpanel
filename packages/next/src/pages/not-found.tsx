import type { RequestContext, ResolvedAdminConfig } from "@flowpanel/core";
import { formatLabel, mergeLabels } from "@flowpanel/core";
import type { MissingRecordCopy } from "@flowpanel/next/client";
import { Button } from "@flowpanel/react";
import Link from "next/link";
import { buildHref } from "../runtime/href";
import { readableByCaller, resourceNavName } from "../runtime/nav";
import { pluralLabel, singularTitle } from "../runtime/resource-title";
import { Wall } from "./wall";

export function NotFound({ config }: { config: ResolvedAdminConfig }) {
  const { notFound } = mergeLabels(config.labels);
  return (
    <Wall
      title={notFound.title}
      description={notFound.description}
      actions={
        <Button asChild variant="outline">
          <Link href={buildHref(config)} prefetch={false}>
            {notFound.back}
          </Link>
        </Button>
      }
    />
  );
}

/** For each resource the reader may open, what its missing record says and where it leads back to. */
export async function missingRecordCopy(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
): Promise<Record<string, MissingRecordCopy>> {
  const { notFound } = mergeLabels(config.labels);
  const copy: Record<string, MissingRecordCopy> = {};
  for (const resource of config.resourcesByName.values()) {
    if (!(await readableByCaller(resource, reqCtx))) continue;
    const name = resourceNavName(resource);
    copy[name] = {
      title: singularTitle(notFound.record, resource, name),
      back: formatLabel(notFound.backTo, { label: pluralLabel(resource, name) }),
      href: buildHref(config, name),
    };
  }
  return copy;
}
