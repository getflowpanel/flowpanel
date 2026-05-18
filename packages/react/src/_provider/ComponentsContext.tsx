"use client";
import {
  type ComponentType,
  createContext,
  type JSX,
  type ReactNode,
  useContext,
  useMemo,
} from "react";
// Import only the pure renderer (no context dependency) to avoid circular refs.
import { DefaultAvatar, type AvatarProps } from "../_atoms/AvatarDefault.js";
import { DefaultBadge, type BadgeProps } from "../_atoms/BadgeDefault.js";
import { DefaultStatusBadge, type StatusBadgeProps } from "../_atoms/StatusBadgeDefault.js";
import {
  DefaultConfirmDialog,
  type ConfirmDialogProps,
} from "../_feedback/ConfirmDialogDefault.js";
import { DefaultEmptyState, type EmptyStateProps } from "../_feedback/EmptyStateDefault.js";
import {
  DefaultSkeletonTable,
  type SkeletonTableProps,
} from "../_feedback/SkeletonTableDefault.js";
import { DefaultPagination, type PaginationProps } from "../_data/PaginationDefault.js";
import { DefaultPageHeader, type PageHeaderProps } from "../_shell/PageHeaderDefault.js";
import { DefaultButton, type ButtonProps } from "../ui/buttonDefault.js";
import { DefaultMetricCard, type MetricCardProps } from "../_widgets/MetricCardDefault.js";

export interface FlowpanelComponentSlots {
  EmptyState: ComponentType<EmptyStateProps>;
  MetricCard: ComponentType<MetricCardProps>;
  /** Override the Button component. Your override SHOULD be forwardRef-aware
   *  to avoid warnings from Radix UI when Button is used with asChild. */
  Button: ComponentType<ButtonProps>;
  Badge: ComponentType<BadgeProps>;
  Avatar: ComponentType<AvatarProps>;
  StatusBadge: ComponentType<StatusBadgeProps>;
  PageHeader: ComponentType<PageHeaderProps>;
  Pagination: ComponentType<PaginationProps>;
  ConfirmDialog: ComponentType<ConfirmDialogProps>;
  SkeletonTable: ComponentType<SkeletonTableProps>;
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
