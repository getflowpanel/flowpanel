"use client";
import type { FlowpanelComponentSlots } from "@flowpanel/core";
import { useMemo } from "react";
import { DefaultAvatar } from "../_atoms/AvatarDefault";
import { DefaultBadge } from "../_atoms/BadgeDefault";
import { DefaultStatusBadge } from "../_atoms/StatusBadgeDefault";
import { DefaultPagination } from "../_data/PaginationDefault";
import { DefaultConfirmDialog } from "../_feedback/ConfirmDialogDefault";
import { DefaultEmptyState } from "../_feedback/EmptyStateDefault";
import { DefaultSkeletonTable } from "../_feedback/SkeletonTableDefault";
import { DefaultPageHeader } from "../_shell/PageHeaderDefault";
import { DefaultMetricCard } from "../_widgets/MetricCardDefault";
import { DefaultButton } from "../ui/buttonDefault";
import { useComponentOverrides } from "./ComponentsContext";

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

/** Every slot resolved — host overrides on top of the shipped defaults. */
export function useComponents(): FlowpanelComponentSlots {
  const overrides = useComponentOverrides();
  return useMemo(() => ({ ...DEFAULTS, ...overrides }), [overrides]);
}
