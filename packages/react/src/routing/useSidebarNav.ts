import type { FlowPanelConfig, FlowPanelPage } from "@flowpanel/core";
import { Activity, FileText, LayoutDashboard, ListOrdered, Table as TableIcon } from "lucide-react";
import { useMemo } from "react";
import type { SidebarNavGroup } from "../layout/Sidebar";
import type { AdminSchema } from "../state/useAdminSchema";
import { titleCaseFromPath } from "../utils/scopeRenderers";

export function useSidebarNav({
  config,
  schema,
  pages,
}: {
  config: FlowPanelConfig;
  schema: AdminSchema;
  pages?: readonly FlowPanelPage[];
}): SidebarNavGroup[] {
  const configTabs = config.tabs ?? [{ id: "pipeline", label: "Pipeline" }];

  return useMemo<SidebarNavGroup[]>(() => {
    const groups: SidebarNavGroup[] = [];

    const coreItems: SidebarNavGroup["items"] = [];
    if (schema.dashboardWidgets.length > 0) {
      coreItems.push({ id: "dashboard", label: "Dashboard", icon: LayoutDashboard });
    }
    for (const t of configTabs) {
      coreItems.push({ id: t.id, label: t.label, icon: Activity });
    }
    if (coreItems.length > 0) {
      groups.push({ id: "core", label: "Monitoring", items: coreItems });
    }

    const resourceEntries = Object.entries(schema.resourceMap);
    if (resourceEntries.length > 0) {
      groups.push({
        id: "resources",
        label: "Data",
        items: resourceEntries.map(([key, res]) => ({
          id: `resource:${key}`,
          label: res.labelPlural,
          icon: TableIcon,
        })),
      });
    }

    const queueEntries = Object.entries(schema.queueMap);
    if (queueEntries.length > 0) {
      groups.push({
        id: "queues",
        label: "Queues",
        items: queueEntries.map(([key, q]) => ({
          id: `queue:${key}`,
          label: q.label,
          icon: ListOrdered,
        })),
      });
    }

    if (pages && pages.length > 0) {
      const byGroup = new Map<string, SidebarNavGroup["items"]>();
      for (const page of pages) {
        if (page.access === false) continue;
        const groupKey = page.group ?? "__pages__";
        if (!byGroup.has(groupKey)) byGroup.set(groupKey, []);
        byGroup.get(groupKey)!.push({
          id: `page:${page.path}`,
          label: page.label ?? titleCaseFromPath(page.path),
          icon: FileText,
        });
      }
      for (const [groupKey, items] of byGroup.entries()) {
        groups.push({
          id: groupKey === "__pages__" ? "pages" : groupKey,
          label: groupKey === "__pages__" ? "Pages" : titleCaseFromPath(groupKey),
          items,
        });
      }
    }

    return groups;
  }, [configTabs, schema.resourceMap, schema.dashboardWidgets, schema.queueMap, pages]);
}
