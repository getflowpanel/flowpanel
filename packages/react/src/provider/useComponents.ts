"use client";
import type { FlowpanelComponentSlots } from "@flowpanel/core";
import { useMemo } from "react";
import { DefaultAvatar } from "../atoms/AvatarDefault";
import { DefaultBadge } from "../atoms/BadgeDefault";
import { DefaultStatusBadge } from "../atoms/StatusBadgeDefault";
import { DefaultPagination } from "../data/PaginationDefault";
import { DefaultConfirmDialog } from "../feedback/ConfirmDialogDefault";
import { DefaultEmptyState } from "../feedback/EmptyStateDefault";
import { DefaultSkeletonTable } from "../feedback/SkeletonTableDefault";
import { DefaultPageHeader } from "../shell/PageHeaderDefault";
import { DefaultButton } from "../ui/button-default";
import { DefaultMetricCard } from "../widgets/MetricCardDefault";
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
