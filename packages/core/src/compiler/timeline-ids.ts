import type { DashboardConfig } from "../types/dashboard";
import type { DetailOptions, DetailTab } from "../types/detail";
import type { ResourceConfig } from "../types/resource";
import type { WidgetConfig } from "../types/widget";

type Row = Record<string, unknown>;
type Slot = { site: string; widgets: WidgetConfig[] | undefined; base?: string };

function explicitIds(slots: readonly Slot[]): Set<string> {
  const taken = new Set<string>();
  for (const { widgets } of slots) {
    for (const widget of widgets ?? []) {
      if (widget.kind === "timeline" && widget.options.id !== undefined) {
        taken.add(widget.options.id);
      }
    }
  }
  return taken;
}

function withIds(slot: Slot, taken: Set<string>): WidgetConfig[] | undefined {
  let seen = 0;
  let changed = false;
  const nextId = (): string => {
    for (;;) {
      seen += 1;
      const base = slot.base ?? "timeline";
      const id = seen === 1 ? base : `${base}-${seen}`;
      if (slot.base !== undefined || !taken.has(id)) return id;
    }
  };
  const widgets = slot.widgets?.map((widget): WidgetConfig => {
    if (widget.kind !== "timeline" || widget.options.id !== undefined) return widget;
    changed = true;
    const id = nextId();
    taken.add(id);
    return { ...widget, options: { ...widget.options, id } };
  });
  return changed ? widgets : slot.widgets;
}

function assertUnique(owner: string, slots: readonly Slot[]): void {
  const seen = new Set<string>();
  for (const { site, widgets } of slots) {
    for (const [index, widget] of (widgets ?? []).entries()) {
      if (widget.kind !== "timeline" || widget.options.id === undefined) continue;
      const id = widget.options.id;
      if (!seen.has(id)) {
        seen.add(id);
        continue;
      }
      throw new Error(
        `flowpanel: ${owner} ${site}[${index}] is a second timeline with the id "${id}" on its ` +
          "page; give each timeline its own id.",
      );
    }
  }
}

function resolveSlots(owner: string, slots: readonly Slot[]): Slot[] {
  const taken = explicitIds(slots);
  const tabbed = slots.map((slot) =>
    slot.base === undefined ? slot : { ...slot, widgets: withIds(slot, taken) },
  );
  const resolved = tabbed.map((slot) =>
    slot.base === undefined ? { ...slot, widgets: withIds(slot, taken) } : slot,
  );
  assertUnique(owner, resolved);
  return resolved;
}

/** A dashboard whose timelines each carry an id of their own: `timeline`, `timeline-2`, … */
export function withDashboardTimelineIds(board: DashboardConfig): DashboardConfig {
  const slots = board.sections.map(
    (section, index): Slot => ({ site: `sections[${index}].widgets`, widgets: section.widgets }),
  );
  const resolved = resolveSlots(`dashboard "${board.path}"`, slots);
  if (resolved.every((slot, index) => slot.widgets === slots[index]?.widgets)) return board;
  return {
    ...board,
    sections: board.sections.map((section, index) => ({
      ...section,
      widgets: resolved[index]?.widgets ?? section.widgets,
    })),
  };
}

/** A record page whose timelines each carry an id: a tab's take its key, the rest `timeline`, … */
export function withRecordTimelineIds(name: string, resource: ResourceConfig): ResourceConfig {
  const detail = resource.options.detail as DetailOptions<Row> | undefined;
  if (!detail) return resource;
  const tabs = detail.tabs ?? [];
  const slots: Slot[] = [
    { site: "detail.stats", widgets: detail.stats as WidgetConfig[] | undefined },
    { site: "detail.aside", widgets: detail.aside },
    ...tabs.map((tab, index) => ({
      site: `detail.tabs[${index}].widgets`,
      widgets: tab.widgets,
      base: tab.key,
    })),
  ];
  const resolved = resolveSlots(`resource "${name}"`, slots);
  if (resolved.every((slot, index) => slot.widgets === slots[index]?.widgets)) return resource;
  const [stats, aside, ...tabWidgets] = resolved;
  const resolvedTabs = tabs.map(
    (tab, index): DetailTab<Row> =>
      tabWidgets[index]?.widgets === tab.widgets
        ? tab
        : { ...tab, widgets: tabWidgets[index]?.widgets ?? [] },
  );
  return {
    ...resource,
    options: {
      ...resource.options,
      detail: {
        ...detail,
        ...(stats?.widgets
          ? { stats: stats.widgets as NonNullable<DetailOptions<Row>["stats"]> }
          : {}),
        ...(aside?.widgets ? { aside: aside.widgets } : {}),
        ...(detail.tabs ? { tabs: resolvedTabs } : {}),
      },
    },
  };
}
