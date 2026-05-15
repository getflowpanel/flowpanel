"use client";
import * as React from "react";
// Import only the pure renderer (no context dependency) to avoid circular refs.
import { DefaultEmptyState, type EmptyStateProps } from "../_feedback/EmptyStateDefault.js";
import { DefaultMetricCard, type MetricCardProps } from "../_widgets/MetricCardDefault.js";
import { DefaultButton, type ButtonProps } from "../ui/buttonDefault.js";
import { DefaultBadge, type BadgeProps } from "../_atoms/BadgeDefault.js";
import { DefaultAvatar, type AvatarProps } from "../_atoms/AvatarDefault.js";
import { DefaultStatusBadge, type StatusBadgeProps } from "../_atoms/StatusBadgeDefault.js";
import { DefaultPageHeader, type PageHeaderProps } from "../_shell/PageHeaderDefault.js";
import { DefaultPagination, type PaginationProps } from "../_data/PaginationDefault.js";
import {
  DefaultConfirmDialog,
  type ConfirmDialogProps,
} from "../_feedback/ConfirmDialogDefault.js";
import {
  DefaultSkeletonTable,
  type SkeletonTableProps,
} from "../_feedback/SkeletonTableDefault.js";

export interface FlowpanelComponentSlots {
  EmptyState: React.ComponentType<EmptyStateProps>;
  MetricCard: React.ComponentType<MetricCardProps>;
  /** Override the Button component. Your override SHOULD be React.forwardRef-aware
   *  to avoid warnings from Radix UI when Button is used with asChild. */
  Button: React.ComponentType<ButtonProps>;
  Badge: React.ComponentType<BadgeProps>;
  Avatar: React.ComponentType<AvatarProps>;
  StatusBadge: React.ComponentType<StatusBadgeProps>;
  PageHeader: React.ComponentType<PageHeaderProps>;
  Pagination: React.ComponentType<PaginationProps>;
  ConfirmDialog: React.ComponentType<ConfirmDialogProps>;
  SkeletonTable: React.ComponentType<SkeletonTableProps>;
}

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

const Ctx = React.createContext<FlowpanelComponentSlots>(DEFAULTS);

export function ComponentsProvider({
  value,
  children,
}: {
  value?: Partial<FlowpanelComponentSlots>;
  children: React.ReactNode;
}): React.JSX.Element {
  const merged = React.useMemo(() => ({ ...DEFAULTS, ...(value ?? {}) }), [value]);
  return <Ctx.Provider value={merged}>{children}</Ctx.Provider>;
}

export function useComponents(): FlowpanelComponentSlots {
  return React.useContext(Ctx);
}
