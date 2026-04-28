/**
 * Components override — users can swap FlowPanel UI primitives with their
 * own without forking. Wire via the top-level <FlowPanelUI components={{...}}>
 * prop; every FP widget reads from `useComponentOverride` and falls back to
 * the built-in shadcn/ui default.
 *
 * Kept tiny by design: the map accepts only the handful of primitives that
 * users realistically want to restyle (Button, Badge, Card). Deep-tree
 * swaps should happen by copy-and-edit via `flowpanel add <widget>` (B9),
 * not by global injection — the override surface is for brand tweaks.
 */

import { type ComponentType, createContext, useContext } from "react";

export interface ComponentOverrides {
  Button?: ComponentType<Record<string, unknown>>;
  Badge?: ComponentType<Record<string, unknown>>;
  Card?: ComponentType<Record<string, unknown>>;
}

const ComponentsContext = createContext<ComponentOverrides>({});

export const ComponentOverridesProvider = ComponentsContext.Provider;

export function useComponentOverride<K extends keyof ComponentOverrides>(
  key: K,
): ComponentOverrides[K] | undefined {
  return useContext(ComponentsContext)[key];
}
