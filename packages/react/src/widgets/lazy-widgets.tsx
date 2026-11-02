"use client";
import { lazyPart } from "../lib/lazy-part";
import type { BarsCardProps } from "./BarsCard";
import type { ChecklistCardProps } from "./ChecklistCard";
import type { FunnelCardProps } from "./FunnelCard";
import type { HeatmapCardProps } from "./HeatmapCard";
import type { KvCardProps } from "./KvCard";
import type { ListCardProps } from "./ListCard";
import type { MetricCardProps } from "./MetricCardDefault";
import type { StatCardProps } from "./StatCard";
import type { StatGroupCardProps } from "./StatGroupCard";
import type { TimelineCardProps } from "./TimelineCard";
import type { TrackerCardProps } from "./TrackerCard";

export const BarsCard = lazyPart<BarsCardProps>(() => import("./BarsCard").then((m) => m.BarsCard));
export const ChecklistCard = lazyPart<ChecklistCardProps>(() =>
  import("./ChecklistCard").then((m) => m.ChecklistCard),
);
export const FunnelCard = lazyPart<FunnelCardProps>(() =>
  import("./FunnelCard").then((m) => m.FunnelCard),
);
export const HeatmapCard = lazyPart<HeatmapCardProps>(() =>
  import("./HeatmapCard").then((m) => m.HeatmapCard),
);
export const KvCard = lazyPart<KvCardProps>(() => import("./KvCard").then((m) => m.KvCard));
export const ListCard = lazyPart<ListCardProps>(() => import("./ListCard").then((m) => m.ListCard));
export const MetricCard = lazyPart<MetricCardProps>(() =>
  import("./MetricCard").then((m) => m.MetricCard),
);
export const StatCard = lazyPart<StatCardProps>(() => import("./StatCard").then((m) => m.StatCard));
export const StatGroupCard = lazyPart<StatGroupCardProps>(() =>
  import("./StatGroupCard").then((m) => m.StatGroupCard),
);
export const TimelineCard = lazyPart<TimelineCardProps>(() =>
  import("./TimelineCard").then((m) => m.TimelineCard),
);
export const TrackerCard = lazyPart<TrackerCardProps>(() =>
  import("./TrackerCard").then((m) => m.TrackerCard),
);
