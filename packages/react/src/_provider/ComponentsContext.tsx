"use client";
import type { FlowpanelComponentSlots } from "@flowpanel/core";
import { createContext, type JSX, type ReactNode, useContext, useMemo } from "react";
import type { AvatarProps } from "../_atoms/AvatarDefault.js";
import type { BadgeProps } from "../_atoms/BadgeDefault.js";
import type { StatusBadgeProps } from "../_atoms/StatusBadgeDefault.js";
import type { PaginationProps } from "../_data/PaginationDefault.js";
import type { ConfirmDialogProps } from "../_feedback/ConfirmDialogDefault.js";
import type { EmptyStateProps } from "../_feedback/EmptyStateDefault.js";
import type { SkeletonTableProps } from "../_feedback/SkeletonTableDefault.js";
import type { PageHeaderProps } from "../_shell/PageHeaderDefault.js";
import type { MetricCardProps } from "../_widgets/MetricCardDefault.js";
import type { ButtonProps } from "../ui/buttonDefault.js";

/** Augment the core slot registry with the 10 shipped React slots. */
declare module "@flowpanel/core" {
  interface FlowpanelComponentSlots {
    EmptyState: import("react").ComponentType<EmptyStateProps>;
    MetricCard: import("react").ComponentType<MetricCardProps>;
    Button: import("react").ComponentType<ButtonProps>;
    Badge: import("react").ComponentType<BadgeProps>;
    Avatar: import("react").ComponentType<AvatarProps>;
    StatusBadge: import("react").ComponentType<StatusBadgeProps>;
    PageHeader: import("react").ComponentType<PageHeaderProps>;
    Pagination: import("react").ComponentType<PaginationProps>;
    ConfirmDialog: import("react").ComponentType<ConfirmDialogProps>;
    SkeletonTable: import("react").ComponentType<SkeletonTableProps>;
  }
}

export type { FlowpanelComponentSlots };

const NO_OVERRIDES: Partial<FlowpanelComponentSlots> = {};

const Ctx = createContext<Partial<FlowpanelComponentSlots>>(NO_OVERRIDES);

export function ComponentsProvider({
  value,
  children,
}: {
  value?: Partial<FlowpanelComponentSlots>;
  children: ReactNode;
}): JSX.Element {
  const merged = useMemo(() => value ?? NO_OVERRIDES, [value]);
  return <Ctx.Provider value={merged}>{children}</Ctx.Provider>;
}

export function useComponentOverrides(): Partial<FlowpanelComponentSlots> {
  return useContext(Ctx);
}

/** Resolve one slot. The caller passes its own default so a slot nobody renders stays out of the graph. */
export function useComponent<K extends keyof FlowpanelComponentSlots>(
  slot: K,
  fallback: FlowpanelComponentSlots[K],
): FlowpanelComponentSlots[K] {
  return (useContext(Ctx)[slot] ?? fallback) as FlowpanelComponentSlots[K];
}
