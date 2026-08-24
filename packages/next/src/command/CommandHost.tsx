"use client";
import type { CommandPaletteConfig, IconName } from "@flowpanel/core";
import {
  type CommandGroupUI,
  CommandPalette,
  FlowpanelIcon,
  toggleTheme,
  useAdminCommand,
} from "@flowpanel/react";
import { useRouter } from "next/navigation";
import { createElement, useMemo } from "react";

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
): CommandGroupUI[] {
  const out: CommandGroupUI[] = [];

  if (!config?.disableNavigation && navItems.length > 0) {
    out.push({
      label: "Navigation",
      items: navItems.map((n) => ({
        label: n.label,
        ...(n.icon
          ? { icon: createElement(FlowpanelIcon, { name: n.icon, className: "h-4 w-4" }) }
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
            ? { icon: createElement(FlowpanelIcon, { name: it.icon, className: "h-4 w-4" }) }
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
      label: "Theme",
      items: [
        {
          label: "Toggle dark mode",
          icon: createElement(FlowpanelIcon, { name: "moon", className: "h-4 w-4" }),
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

export function CommandHost({ navItems, config }: CommandHostProps) {
  const router = useRouter();
  const { open, setOpen, close } = useAdminCommand();

  const groups = useMemo<CommandGroupUI[]>(
    () => buildCommandGroups(navItems, config, { push: router.push, close }),
    [navItems, config, router, close],
  );

  return (
    <CommandPalette
      open={open}
      onOpenChange={setOpen}
      groups={groups}
      {...(config?.placeholder ? { placeholder: config.placeholder } : {})}
    />
  );
}
