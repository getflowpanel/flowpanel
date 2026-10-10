"use client";
import {
  DateRangeFilter,
  SelectFilter,
  type SelectFilterOption,
  useLabels,
} from "@flowpanel/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export interface AuditLogFiltersProps {
  actors: SelectFilterOption[];
  resources: SelectFilterOption[];
  actions: SelectFilterOption[];
}

/** Who, which resource, which action and when; each change resets the page. */
export function AuditLogFilters({ actors, resources, actions }: AuditLogFiltersProps) {
  const { audit } = useLabels();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const set = (key: "actor" | "resource" | "action" | "date", value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    if (value) params.set(key, value);
    else params.delete(key);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };
  return (
    <div className="fp-flex fp-flex-wrap fp-items-center fp-gap-2" data-fp-audit-filters="">
      <SelectFilter
        label={audit.actor}
        value={searchParams.get("actor")}
        options={actors}
        onChange={(value) => set("actor", value)}
      />
      <SelectFilter
        label={audit.resource}
        value={searchParams.get("resource")}
        options={resources}
        onChange={(value) => set("resource", value)}
      />
      <SelectFilter
        label={audit.action}
        value={searchParams.get("action")}
        options={actions}
        onChange={(value) => set("action", value)}
      />
      <DateRangeFilter
        label={audit.date}
        value={searchParams.get("date")}
        onChange={(value) => set("date", value)}
      />
    </div>
  );
}
