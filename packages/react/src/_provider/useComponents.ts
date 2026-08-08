"use client";
import type { FlowpanelComponentSlots } from "@flowpanel/core";
import { useMemo } from "react";
import { DefaultAvatar } from "../_atoms/AvatarDefault.js";
import { DefaultBadge } from "../_atoms/BadgeDefault.js";
import { DefaultStatusBadge } from "../_atoms/StatusBadgeDefault.js";
import { DefaultPagination } from "../_data/PaginationDefault.js";
import { DefaultConfirmDialog } from "../_feedback/ConfirmDialogDefault.js";
import { DefaultEmptyState } from "../_feedback/EmptyStateDefault.js";
import { DefaultSkeletonTable } from "../_feedback/SkeletonTableDefault.js";
import { DefaultPageHeader } from "../_shell/PageHeaderDefault.js";
import { DefaultMetricCard } from "../_widgets/MetricCardDefault.js";
import { DefaultButton } from "../ui/buttonDefault.js";
import { useComponentOverrides } from "./ComponentsContext.js";

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
