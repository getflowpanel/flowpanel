"use client";
import type { FlowpanelComponentSlots } from "@flowpanel/core";
import { createContext, type JSX, type ReactNode, useContext, useMemo } from "react";
import { type AvatarProps, DefaultAvatar } from "../_atoms/AvatarDefault.js";
import { type BadgeProps, DefaultBadge } from "../_atoms/BadgeDefault.js";
import { DefaultStatusBadge, type StatusBadgeProps } from "../_atoms/StatusBadgeDefault.js";
import { DefaultPagination, type PaginationProps } from "../_data/PaginationDefault.js";
import {
  type ConfirmDialogProps,
  DefaultConfirmDialog,
} from "../_feedback/ConfirmDialogDefault.js";
import { DefaultEmptyState, type EmptyStateProps } from "../_feedback/EmptyStateDefault.js";
import {
  DefaultSkeletonTable,
  type SkeletonTableProps,
} from "../_feedback/SkeletonTableDefault.js";
import { DefaultPageHeader, type PageHeaderProps } from "../_shell/PageHeaderDefault.js";
import { DefaultMetricCard, type MetricCardProps } from "../_widgets/MetricCardDefault.js";
import { type ButtonProps, DefaultButton } from "../ui/buttonDefault.js";

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

const DEFAULTS: FlowpanelComponentSlots = {
  EmptyState: DefaultEmptyState,
  MetricCard: DefaultMetricCard,
  Button: DefaultButton,
  Badge: DefaultBadge,
  Avatar: DefaultAvatar,
  StatusBadge: DefaultStatusBadge,
  PageHeader: DefaultPageHeader,
  Pagination: DefaultPagination,
  ConfirmDialog: DefaultConfirmDialog,
  SkeletonTable: DefaultSkeletonTable,
};

const Ctx = createContext<FlowpanelComponentSlots>(DEFAULTS);

export function ComponentsProvider({
  value,
  children,
}: {
  value?: Partial<FlowpanelComponentSlots>;
  children: ReactNode;
}): JSX.Element {
  const merged = useMemo(() => ({ ...DEFAULTS, ...(value ?? {}) }), [value]);
  return <Ctx.Provider value={merged}>{children}</Ctx.Provider>;
}

export function useComponents(): FlowpanelComponentSlots {
  return useContext(Ctx);
}
