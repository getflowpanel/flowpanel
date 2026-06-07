/** One entry in the ⌘K palette. */
export interface CommandItem {
  label: string;
  /** Lucide icon name. */
  icon?: string;
  /** Shortcut hint shown on the right, e.g. `"⌘J"`. Display only — bind it yourself. */
  shortcut?: string;
  /** Extra terms that should match this item in search. */
  keywords?: string[];
  /** What running the item does. Only `navigate` is supported. */
  action: { type: "navigate"; href: string };
}

/** A labelled block of entries in the palette. */
export interface CommandGroup {
  label: string;
  items: CommandItem[];
}

export interface CommandPaletteConfig {
  /** Your own groups, listed after the built-in ones. */
  groups?: CommandGroup[];
  /** Placeholder text for the input. Defaults to "Search resources, actions…". */
  placeholder?: string;
  /** Drop the built-in group that links to every resource. */
  disableNavigation?: boolean;
  /** Drop the built-in light/dark toggle. */
  disableTheme?: boolean;
}
