// LOC-OK: public package barrel mirrors the documented component surface in one entrypoint.
export type { FlowpanelComponentSlots } from "@flowpanel/core";
export { Avatar, type AvatarProps, DefaultAvatar } from "./_atoms/Avatar";
export { Badge, type BadgeProps, type BadgeTone, DefaultBadge } from "./_atoms/Badge";
export { FlowpanelIcon, type FlowpanelIconProps } from "./_atoms/FlowpanelIcon";
export { LiveIndicator, type LiveIndicatorProps } from "./_atoms/LiveIndicator";
export { LocalTime, type LocalTimeProps } from "./_atoms/LocalTime";
export { Mono } from "./_atoms/Mono";
export { Sparkline, type SparklineProps } from "./_atoms/Sparkline";
export {
  DefaultStatusBadge,
  StatusBadge,
  type StatusBadgeProps,
  type StatusBadgeTone,
} from "./_atoms/StatusBadge";
export { StatusDot, type StatusTone } from "./_atoms/StatusDot";
export { TimeAgo, type TimeAgoProps } from "./_atoms/TimeAgo";
export { ArrayCell, type ArrayCellProps } from "./_data/ArrayCell";
export { BulkBar, type BulkBarAction, type BulkBarProps } from "./_data/BulkBar";
export {
  ColumnPinMenu,
  type ColumnPinMenuProps,
  type PinSide,
} from "./_data/ColumnPinMenu";
export {
  ColumnVisibilityMenu,
  type ColumnVisibilityMenuColumn,
  type ColumnVisibilityMenuProps,
} from "./_data/ColumnVisibilityMenu";
export {
  DataTable,
  type DataTableColumn,
  type DataTableProps,
  type DataTableSort,
} from "./_data/DataTable";
export { DateRangePicker, type DateRangePickerProps } from "./_data/DateRangePicker";
export {
  type DataTableDensity,
  DensityToggle,
  type DensityToggleProps,
} from "./_data/DensityToggle";
export { FilterBar, type FilterBarProps, type FilterBarSpec } from "./_data/FilterBar";
export {
  BooleanFilter,
  type BooleanFilterProps,
} from "./_data/filters/BooleanFilter";
export {
  DateRangeFilter,
  type DateRangeFilterProps,
} from "./_data/filters/DateRangeFilter";
export {
  MultiSelectFilter,
  type MultiSelectFilterOption,
  type MultiSelectFilterProps,
} from "./_data/filters/MultiSelectFilter";
export {
  NumericRangeFilter,
  type NumericRangeFilterProps,
} from "./_data/filters/NumericRangeFilter";
export {
  SelectFilter,
  type SelectFilterOption,
  type SelectFilterProps,
} from "./_data/filters/SelectFilter";
export { TagFilter, type TagFilterProps } from "./_data/filters/TagFilter";
export { TextFilter, type TextFilterProps } from "./_data/filters/TextFilter";
export { InlineEditCell, type InlineEditCellProps } from "./_data/InlineEditCell";
export { JsonCell, type JsonCellProps } from "./_data/JsonCell";
export { JsonEditor, type JsonEditorProps } from "./_data/JsonEditor";
export { KV, KVRow } from "./_data/KV";
export { MobileCardList, type MobileCardListProps } from "./_data/MobileCardList";
export { DefaultPagination, Pagination, type PaginationProps } from "./_data/Pagination";
export { ReferenceCell, type ReferenceCellProps } from "./_data/ReferenceCell";
export {
  type ReferenceItem,
  ReferencePicker,
  type ReferencePickerProps,
} from "./_data/ReferencePicker";
export { renderFormatCell } from "./_data/render-format";
export {
  ConfirmDialog,
  type ConfirmDialogProps,
  DefaultConfirmDialog,
} from "./_feedback/ConfirmDialog";
export { EmptyState, type EmptyStateProps } from "./_feedback/EmptyState";
export { DefaultEmptyState } from "./_feedback/EmptyStateDefault";
export { ErrorCard } from "./_feedback/ErrorCard";
export { ErrorState, type ErrorStateProps } from "./_feedback/ErrorState";
export { HealthBanner, type HealthBannerProps } from "./_feedback/HealthBanner";
export {
  DashboardSkeleton,
  type DashboardSkeletonProps,
  ResourceDetailSkeleton,
  type ResourceDetailSkeletonProps,
  ResourceListSkeleton,
  type ResourceListSkeletonProps,
} from "./_feedback/PageSkeletons";
export { SkeletonCard } from "./_feedback/SkeletonCard";
export {
  DefaultSkeletonTable,
  SkeletonTable,
  type SkeletonTableProps,
} from "./_feedback/SkeletonTable";
export { ToastProvider } from "./_feedback/Toast";
export { type ToastApi, useToast } from "./_feedback/toast-api";
export { Toast } from "./_feedback/toast-handle";
export {
  AsyncSelect,
  type AsyncSelectOption,
  type AsyncSelectProps,
} from "./_forms/AsyncSelect";
export { AutoForm, type AutoFormProps } from "./_forms/AutoForm";
export { Field as FormField, type FieldProps as FormFieldProps } from "./_forms/Field";
export { Form, type FormActionResult, type FormProps, useFormContext } from "./_forms/Form";
export { FormError } from "./_forms/FormError";
export { FormSection, type FormSectionProps } from "./_forms/FormSection";
export { FormSubmit } from "./_forms/FormSubmit";
export type { ResolvedField } from "./_forms/field-types";
export {
  StandaloneFormFields,
  type StandaloneFormFieldsProps,
} from "./_forms/StandaloneFormFields";
export {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "./_layout/Card";
export { MetricGrid, type MetricGridProps } from "./_layout/MetricGrid";
export {
  Divider,
  type DividerProps,
  Section,
  SectionLabel,
  type SectionLabelProps,
  type SectionProps,
  spanClass,
} from "./_layout/Section";
export { ApiBaseProvider, useApiBase } from "./_provider/ApiBaseContext";
export {
  ComponentsProvider,
  useComponent,
  useComponentOverrides,
} from "./_provider/ComponentsContext";
export { LabelsProvider, useLabels } from "./_provider/LabelsContext";
export { useComponents } from "./_provider/useComponents";
export {
  AccountMenu,
  type AccountMenuItem,
  type AccountMenuProps,
  type AccountMenuUser,
} from "./_shell/AccountMenu";
export { AdminNav, type NavEntry, type NavGroup } from "./_shell/AdminNav";
export {
  AdminShell,
  type AdminShellProps,
  type AdminShellVariant,
} from "./_shell/AdminShell";
export { AdminTabs } from "./_shell/AdminTabs";
export { Brand, type BrandProps, type ShellBrand } from "./_shell/Brand";
export {
  type BreadcrumbItem,
  Breadcrumbs,
  type BreadcrumbsProps,
} from "./_shell/Breadcrumbs";
export {
  type CommandGroupUI,
  CommandPalette,
  type CommandPaletteProps,
} from "./_shell/CommandPalette";
export { DetailShell, type DetailShellProps } from "./_shell/DetailShell";
export {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  type DrawerProps,
  type DrawerWidth,
} from "./_shell/Drawer";
export { FlowpanelGlobals, type FlowpanelGlobalsProps } from "./_shell/FlowpanelGlobals";
export { DefaultPageHeader, PageHeader, type PageHeaderProps } from "./_shell/PageHeader";
export {
  DEFAULT_SHORTCUTS,
  type ShortcutSpec,
  ShortcutsCheatsheet,
  type ShortcutsCheatsheetProps,
} from "./_shell/ShortcutsCheatsheet";
export { ThemeScript, type ThemeScriptProps } from "./_shell/ThemeScript";
export { CustomWidget, type CustomWidgetProps } from "./_widgets/CustomWidget";
export { MetricCard, type MetricCardProps } from "./_widgets/MetricCard";
export { DefaultMetricCard } from "./_widgets/MetricCardDefault";
export { StatGroupCard, type StatGroupCardProps } from "./_widgets/StatGroupCard";
export { TableWidget, type TableWidgetProps } from "./_widgets/TableWidget";
export { DevToolsPanel, type DevToolsPanelProps } from "./devtools/DevToolsPanel";
export { type AdminCommand, useAdminCommand } from "./hooks/useAdminCommand";
export {
  type AdminDrawer,
  type AdminDrawerState,
  useAdminDrawer,
} from "./hooks/useAdminDrawer";
export {
  type TableSort,
  type UseAdminTable,
  useAdminTable,
} from "./hooks/useAdminTable";
export {
  type UseDashboardParamResult,
  useDashboardParam,
} from "./hooks/useDashboardParam";
export {
  type LiveStatus,
  type UseLiveChannelOptions,
  useLiveChannel,
} from "./hooks/useLiveChannel";
export { useMediaQuery } from "./hooks/useMediaQuery";
export { useOptimisticAction } from "./hooks/useOptimisticAction";
export {
  type RealtimeChannels,
  RealtimeRefresh,
  type UseRealtimeRefreshOptions,
  useRealtimeRefresh,
} from "./hooks/useRealtimeRefresh";
export { type UseTheme, type UseThemeOptions, useTheme } from "./hooks/useTheme";
export { type UrlState, useUrlState } from "./hooks/useUrlState";
export { cn } from "./lib/cn";
export { formatNumber, type NumericFormat, type Tone } from "./lib/format";
export { humanize, resolveFieldLabel } from "./lib/humanize";
export {
  applyThemeClass,
  buildThemeInitScript,
  readStoredTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ThemeChoice,
  type ThemeMode,
  toggleTheme,
  writeStoredTheme,
} from "./lib/theme";
export { type DownloadPayload, triggerDownload } from "./lib/trigger-download";
export type {
  RealtimeBus,
  RealtimeProviderProps,
  RealtimeStats,
  RealtimeStatus,
} from "./realtime/context";
export {
  useRealtimeBus,
  useRealtimeStats,
  useRealtimeStatus,
} from "./realtime/hooks";
export { RealtimeProvider } from "./realtime/RealtimeProvider";
export { Button, type ButtonProps, buttonVariants, DefaultButton } from "./ui/button";
export { Checkbox } from "./ui/checkbox";
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
export { Input } from "./ui/input";
export { Label } from "./ui/label";
export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "./ui/popover";
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
export { Skeleton } from "./ui/skeleton";
export { Switch } from "./ui/switch";
export { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
