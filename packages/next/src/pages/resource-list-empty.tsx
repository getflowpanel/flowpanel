import type { ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { formatLabel, mergeLabels } from "@flowpanel/core";
import { CreateDrawerTrigger } from "@flowpanel/next/client";
import { Button, FlowpanelIcon } from "@flowpanel/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { buildHref } from "../runtime/href";
import { fillLabel, singularTitle } from "../runtime/resource-title";

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
      <Link href={href} prefetch={false}>
        {label}
      </Link>
    </Button>
  );
}

/** An empty list says why it is empty and offers the next step: clear the filters, or create the first row. */
export function listEmptyProps(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  name: string,
  plural: string,
  narrowed: {
    filtered: boolean;
    /** Only a search narrowed the list, no filter. */
    searchOnly?: boolean;
    params: URLSearchParams;
    search?: string;
    defaulted?: ReadonlyArray<{ field: string }>;
    creatable?: boolean;
  },
): EmptyProps {
  const empty = resource.options.empty;
  const labels = mergeLabels(config.labels);
  if (narrowed.filtered) {
    const query = narrowed.search ?? "";
    const searchOnly = narrowed.searchOnly === true && query !== "";
    const title =
      (query && empty?.searched) ||
      empty?.filtered ||
      (searchOnly ? labels.table.noSearchMatch : labels.widget.filtered);
    return {
      emptyTitle: formatLabel(title, { query }),
      emptyAction: linkButton(
        clearedHref(config, name, narrowed.params, narrowed.defaulted ?? []),
        searchOnly ? labels.filters.clearSearch : labels.filters.clear,
        "outline",
      ),
    };
  }
  const creatable = narrowed.creatable === true;
  const action = empty?.action ? (
    linkButton(empty.action.href, empty.action.label)
  ) : creatable ? (
    <CreateDrawerTrigger
      label={singularTitle(labels.table.createFirst, resource, name, labels.dateRange.locale)}
    />
  ) : null;
  return {
    emptyTitle: empty?.title ?? fillLabel(labels.table.empty, plural, labels.dateRange.locale),
    emptyDescription:
      empty?.description ??
      fillLabel(
        creatable ? labels.table.emptyDescription : labels.table.emptyReadOnlyDescription,
        plural,
        labels.dateRange.locale,
      ),
    ...(empty?.icon
      ? { emptyIcon: <FlowpanelIcon name={empty.icon} className="fp-h-6 fp-w-6" /> }
      : {}),
    ...(action ? { emptyAction: action } : {}),
  };
}
