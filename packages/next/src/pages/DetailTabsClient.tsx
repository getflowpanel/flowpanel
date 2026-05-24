"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@flowpanel/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type * as React from "react";

/**
 * Client-side tab switcher rendered below the detail page header. Tab
 * contents are server-prerendered React nodes — the client side only
 * controls which one is visible. The selected key is persisted as
 * `?tab=<key>` so URLs share the open tab.
 *
 * When the URL has no `?tab=` param or the param doesn't match a tab,
 * we fall back to the first non-hidden tab. The hidden filter ran
 * server-side already, so every tab in `tabs` is presentable here.
 */
export interface DetailTabsClientProps {
  /** First entry is the default when `?tab=` is absent. */
  tabs: ReadonlyArray<{ key: string; label: string; content: React.ReactNode }>;
}

export function DetailTabsClient({ tabs }: DetailTabsClientProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [firstTab] = tabs;
  if (!firstTab) return null;

  const requested = searchParams.get("tab");
  const initial = tabs.find((t) => t.key === requested)?.key ?? firstTab.key;

  return (
    <Tabs
      value={initial}
      onValueChange={(next) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("tab", next);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      }}
    >
      <TabsList>
        {tabs.map((t) => (
          <TabsTrigger key={t.key} value={t.key}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent key={t.key} value={t.key}>
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
