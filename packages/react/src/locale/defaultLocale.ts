export const defaultLocale = {
  searchPlaceholder: "Search runs...",
  loadMore: "Load more",
  noRunsTitle: "No pipeline runs yet",
  noRunsDescription: "Wrap your worker functions with withRun() to start tracking.",
  noMatchTitle: "No runs match filters",
  noMatchDescription: "Try changing your search or filter criteria.",
  statusAll: "All",
  statusRunning: "Running",
  statusFailed: "Failed",
  statusSucceeded: "Succeeded",
  justNow: "just now",
  liveStatus: "Live",
  reconnecting: "Reconnecting...",
  polling: "Polling",
  paused: "Paused",
  commandPlaceholder: "Type to filter...",
  noCommands: "No commands found",
  clearFilters: "Clear filters",
  refreshData: "Refresh data",
  close: "Close",
  retry: "Retry",
  sessionExpired: "Session expired",
  serverError: "Server error",
  connectionLost: "Connection lost",
  skipToMain: "Skip to main content",
  prevRun: "Previous run",
  nextRun: "Next run",
  newRuns: (count: number) => `${count} new run${count > 1 ? "s" : ""}`,
} as const;

export type FlowPanelLocale = {
  [K in keyof typeof defaultLocale]: (typeof defaultLocale)[K];
};
