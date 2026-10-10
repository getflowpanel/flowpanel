"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger, useAdminDrawer } from "@flowpanel/react";
import { DrawerFieldsView } from "./DrawerFieldsView";
import { DrawerResourceTab } from "./DrawerResourceTab";
import { DrawerWidgetsTab } from "./DrawerWidgetsTab";
import type { DrawerPayload } from "./drawer-payload";
import { rememberedCell } from "./table-cells";

/** One record's fields, or its tabs with the open one named in the URL. */
export function DrawerBody({
  payload,
  resource,
  id,
}: {
  payload: DrawerPayload;
  resource: string;
  id: string;
}) {
  const { state, open } = useAdminDrawer();
  const listCell = (field: string) => rememberedCell(resource, id, field);
  const fields = (list: DrawerPayload["fields"]) => (
    <DrawerFieldsView
      row={payload.row}
      fields={list}
      prerendered={payload.prerendered}
      labels={payload.labels}
      formats={payload.formats}
      listCell={listCell}
    />
  );
  const tabs = payload.tabs;
  if (!tabs || tabs.length === 0) return fields(payload.fields);
  const active = tabs.some((t) => t.key === state.tab) ? state.tab : tabs[0]?.key;
  return (
    <Tabs value={active ?? ""} onValueChange={(tab) => open({ resource, id, tab })}>
      <TabsList>
        {tabs.map((t) => (
          <TabsTrigger key={t.key} value={t.key}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent key={t.key} value={t.key} className="fp-mt-4">
          {t.kind === "fields" ? (
            fields(t.fields)
          ) : t.kind === "resource" ? (
            <DrawerResourceTab tab={t} />
          ) : (
            <DrawerWidgetsTab tab={t} />
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
