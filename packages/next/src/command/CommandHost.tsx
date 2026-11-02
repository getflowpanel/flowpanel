"use client";
import type { CommandPaletteConfig, IconName } from "@flowpanel/core";
import { DEFAULT_LABELS, type ResolvedLabels } from "@flowpanel/core/labels";
import {
  type CommandGroupUI,
  CommandPalette,
  confirmLeave,
  FlowpanelIcon,
  toggleTheme,
  useAdminCommand,
  useApiBase,
  useLabels,
} from "@flowpanel/react";
import { useRouter } from "next/navigation";
import { createElement, useCallback, useEffect, useMemo, useState } from "react";
import { MIN_RECORD_QUERY, type RecordSearchGroup } from "./record-search-wire";

export interface CommandHostNavItem {
  label: string;
  href: string;
  icon?: IconName;
}

export interface CommandHostProps {
  navItems: CommandHostNavItem[];
  config?: CommandPaletteConfig;
}

/** The two side effects every `onSelect` triggers, factored out so `buildCommandGroups` is pure and testable without rendering. */
export interface CommandNav {
  push: (href: string) => void;
  close: () => void;
}

export function buildCommandGroups(
  navItems: CommandHostNavItem[],
  config: CommandPaletteConfig | undefined,
  nav: CommandNav,
  labels: ResolvedLabels = DEFAULT_LABELS,
): CommandGroupUI[] {
  const out: CommandGroupUI[] = [];

  if (!config?.disableNavigation && navItems.length > 0) {
    out.push({
      label: labels.navigation.title,
      items: navItems.map((n) => ({
        label: n.label,
        ...(n.icon
          ? { icon: createElement(FlowpanelIcon, { name: n.icon, className: "fp-h-4 fp-w-4" }) }
          : {}),
        onSelect: () => {
          nav.close();
          nav.push(n.href);
        },
      })),
    });
  }

  if (config?.groups) {
    for (const g of config.groups) {
      out.push({
        label: g.label,
        items: g.items.map((it) => ({
          label: it.label,
          ...(it.icon
            ? { icon: createElement(FlowpanelIcon, { name: it.icon, className: "fp-h-4 fp-w-4" }) }
            : {}),
          onSelect: () => {
            nav.close();
            nav.push(it.action.href);
          },
          ...(it.shortcut ? { shortcut: it.shortcut } : {}),
          ...(it.keywords ? { keywords: it.keywords } : {}),
        })),
      });
    }
  }

  if (!config?.disableTheme) {
    out.push({
      label: labels.navigation.theme,
      items: [
        {
          label: labels.navigation.toggleTheme,
          icon: createElement(FlowpanelIcon, { name: "moon", className: "fp-h-4 fp-w-4" }),
          onSelect: () => {
            nav.close();
            toggleTheme();
          },
        },
      ],
    });
  }

  return out;
}

/** The palette's record groups, ahead of the navigation it always offers. */
export function recordCommandGroups(
  groups: RecordSearchGroup[],
  query: string,
  nav: CommandNav,
): CommandGroupUI[] {
  return groups.map((group) => ({
    label: group.label,
    items: group.items.map((item) => ({
      label: item.title,
      value: item.href,
      // The server matched the query on a field the line may not show, so the line always matches it.
      keywords: [query],
      ...(item.detail ? { detail: item.detail } : {}),
      onSelect: () => {
        nav.close();
        nav.push(item.href);
      },
    })),
  }));
}

/** Records matching the palette's query, fetched once typing pauses. */
function useRecordSearch(query: string, enabled: boolean) {
  const apiBase = useApiBase();
  const [found, setFound] = useState<{ query: string; groups: RecordSearchGroup[] }>({
    query: "",
    groups: [],
  });
  const trimmed = query.trim();
  const active = enabled && trimmed.length >= MIN_RECORD_QUERY;
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`${apiBase}/palette/search?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
        cache: "no-store",
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((body: { groups?: RecordSearchGroup[] } | null) => {
          setFound({ query: trimmed, groups: Array.isArray(body?.groups) ? body.groups : [] });
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setFound({ query: trimmed, groups: [] });
        });
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [active, trimmed, apiBase]);
  return {
    groups: active && found.query === trimmed ? found.groups : [],
    loading: active && found.query !== trimmed,
  };
}

const SEARCH_DELAY_MS = 250;

export function CommandHost({ navItems, config }: CommandHostProps) {
  const labels = useLabels();
  const router = useRouter();
  const { open, setOpen, close } = useAdminCommand();
  const [query, setQuery] = useState("");
  const records = useRecordSearch(query, open);

  const push = useCallback((href: string) => confirmLeave(() => router.push(href)), [router]);
  const groups = useMemo<CommandGroupUI[]>(
    () => [
      ...recordCommandGroups(records.groups, query.trim(), { push, close }),
      ...buildCommandGroups(navItems, config, { push, close }, labels),
    ],
    [records.groups, query, navItems, config, push, close, labels],
  );

  return (
    <CommandPalette
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
      groups={groups}
      onSearch={setQuery}
      itemsLoading={records.loading}
      {...(config?.placeholder ? { placeholder: config.placeholder } : {})}
    />
  );
}
