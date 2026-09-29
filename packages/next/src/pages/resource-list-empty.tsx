import type { ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { formatLabel, mergeLabels } from "@flowpanel/core";
import { Button, FlowpanelIcon } from "@flowpanel/react";
import type { ReactNode } from "react";
import { buildHref } from "../runtime/href";

interface EmptyProps {
  emptyTitle: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  emptyAction?: ReactNode;
}

function clearedHref(
  config: ResolvedAdminConfig,
  name: string,
  params: URLSearchParams,
  defaulted: ReadonlyArray<{ field: string }>,
): string {
  const kept = new URLSearchParams(
    [...params].filter(([key]) => key !== "q" && key !== "page" && !key.startsWith("f_")),
  );
  for (const { field } of defaulted) kept.set(`f_${field}`, "");
  const query = kept.toString();
  return `${buildHref(config, name)}${query ? `?${query}` : ""}`;
}

function linkButton(href: string, label: string, variant?: "outline"): ReactNode {
  return (
    <Button asChild {...(variant ? { variant } : {})}>
      <a href={href}>{label}</a>
    </Button>
  );
}

/** An empty list says whether there is no data yet or the search and filters found none. */
export function listEmptyProps(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  name: string,
  plural: string,
  narrowed: {
    filtered: boolean;
    params: URLSearchParams;
    search?: string;
    defaulted?: ReadonlyArray<{ field: string }>;
  },
): EmptyProps {
  const empty = resource.options.empty;
  if (narrowed.filtered) {
    const labels = mergeLabels(config.labels);
    const query = narrowed.search ?? "";
    const title = (query && empty?.searched) || empty?.filtered || labels.widget.filtered;
    return {
      emptyTitle: formatLabel(title, { query }),
      emptyAction: linkButton(
        clearedHref(config, name, narrowed.params, narrowed.defaulted ?? []),
        labels.filters.clear,
        "outline",
      ),
    };
  }
  return {
    emptyTitle: empty?.title ?? `No ${plural}`,
    ...(empty?.description ? { emptyDescription: empty.description } : {}),
    ...(empty?.icon ? { emptyIcon: <FlowpanelIcon name={empty.icon} className="h-6 w-6" /> } : {}),
    ...(empty?.action ? { emptyAction: linkButton(empty.action.href, empty.action.label) } : {}),
  };
}
