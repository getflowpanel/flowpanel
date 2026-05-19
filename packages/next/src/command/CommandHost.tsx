"use client";
import type { CommandPaletteConfig } from "@flowpanel/core";
import {
  type CommandGroupUI,
  CommandPalette,
  toggleTheme,
  useAdminCommand,
} from "@flowpanel/react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

export interface CommandHostNavItem {
  label: string;
  href: string;
}

export interface CommandHostProps {
  navItems: CommandHostNavItem[];
  config?: CommandPaletteConfig;
}

/**
 * Wires the ⌘K `CommandPalette` to built-in Navigation + Theme groups plus
 * any user-defined groups from `config.commandPalette`. Cross-resource
 * Items search (Spec §14) is deferred — it depends on `adapter.searchItems`
 * which is not part of the Adapter contract in M2.
 */
export function CommandHost({ navItems, config }: CommandHostProps) {
  const router = useRouter();
  const { open, setOpen, close } = useAdminCommand();

  const groups = useMemo<CommandGroupUI[]>(() => {
    const out: CommandGroupUI[] = [];

    if (!config?.disableNavigation && navItems.length > 0) {
      out.push({
        label: "Navigation",
        items: navItems.map((n) => ({
          label: n.label,
          onSelect: () => {
            close();
            router.push(n.href);
          },
        })),
      });
    }

    if (config?.groups) {
      for (const g of config.groups) {
        out.push({
          label: g.label,
          items: g.items.map((it) => {
            const onSelect =
              it.action.type === "navigate"
                ? () => {
                    close();
                    router.push(it.action.type === "navigate" ? it.action.href : "/");
                  }
                : () => {
                    close();
                    if (it.action.type === "run") {
                      void it.action.fn({ session: null });
                    }
                  };
            return {
              label: it.label,
              onSelect,
              ...(it.shortcut ? { shortcut: it.shortcut } : {}),
              ...(it.keywords ? { keywords: it.keywords } : {}),
            };
          }),
        });
      }
    }

    if (!config?.disableTheme) {
      out.push({
        label: "Theme",
        items: [
          {
            label: "Toggle dark mode",
            onSelect: () => {
              close();
              toggleTheme();
            },
          },
        ],
      });
    }

    return out;
  }, [navItems, config, router, close]);

  return (
    <CommandPalette
      open={open}
      onOpenChange={setOpen}
      groups={groups}
      {...(config?.placeholder ? { placeholder: config.placeholder } : {})}
    />
  );
}
