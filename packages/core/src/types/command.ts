import type { Session } from "./session.js";

export interface CommandItem {
  label: string;
  icon?: string;
  shortcut?: string;
  keywords?: string[];
  action:
    | { type: "navigate"; href: string }
    | { type: "run"; fn: (ctx: { session: Session | null }) => Promise<unknown> | unknown };
}

export interface CommandGroup {
  label: string;
  items: CommandItem[];
}

export interface CommandPaletteConfig {
  groups?: CommandGroup[];
  /** Placeholder text for the input. Default: "Search resources, actions…" */
  placeholder?: string;
  /** Disable the built-in Navigation group. */
  disableNavigation?: boolean;
  /** Disable built-in Items group (fuzzy search across resources via adapter.searchItems). */
  disableItems?: boolean;
  /** Disable light/dark toggle group. */
  disableTheme?: boolean;
}
