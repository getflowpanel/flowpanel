import type { ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { mergeLabels } from "@flowpanel/core";
import { Button, FlowpanelIcon } from "@flowpanel/react";
import type { ReactNode } from "react";
import { buildHref } from "../runtime/href";

interface EmptyProps {
  emptyTitle: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  emptyAction?: ReactNode;
}

function clearedHref(config: ResolvedAdminConfig, name: string, params: URLSearchParams): string {
  const kept = new URLSearchParams(
    [...params].filter(([key]) => key !== "q" && key !== "page" && !key.startsWith("f_")),
  );
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
  narrowed: { filtered: boolean; params: URLSearchParams },
): EmptyProps {
  const empty = resource.options.empty;
  if (narrowed.filtered) {
    const labels = mergeLabels(config.labels);
    return {
      emptyTitle: empty?.filtered ?? labels.widget.filtered,
      emptyAction: linkButton(
        clearedHref(config, name, narrowed.params),
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
