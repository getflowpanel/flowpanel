import {
  type ChecklistItem,
  checklist,
  type DrawerTabWidgets,
  filled,
  heatmap,
} from "@flowpanel/core";
import { expectError, expectType } from "tsd";

heatmap({
  label: "Visits",
  source: { resource: "visits", at: "startedAt", where: { userId: 1 } },
  days: 91,
});
heatmap({ source: { resource: "visits", at: "startedAt", by: "userId" } });
expectError(heatmap({ source: { resource: "visits", at: "startedAt", by: "usrId" } }));
heatmap({
  query: async () => [{ at: "2026-09-25", value: 3 }],
  unit: { one: "{n} visit", other: "{n} visits" },
});
expectError(heatmap({ source: { resource: "visits", at: "startedat" } }));
expectError(heatmap({ source: { resource: "visits", at: "startedAt", value: "count" } }));
expectError(heatmap({ source: { resource: "visits", at: "startedAt" }, layout: "hours" }));
expectError<DrawerTabWidgets>({ key: "a", label: "A", widgets: [heatmap({})] });

checklist({
  label: "Journey",
  ordered: true,
  layout: "steps",
  items: async () => [{ label: "Signed up", done: new Date(), precision: "day" }],
});
checklist({
  summary: false,
  items: [
    {
      label: "Bio",
      done: "",
      optional: true,
      hint: "What the model reads",
      tone: "accent",
      href: { resource: "users", id: 1 },
    },
  ],
});
expectError(checklist({ items: [], layout: "grid" }));
expectError(checklist({ items: [{ done: true }] }));
expectError(checklist({ items: [{ label: "Bio", done: true, precision: "hour" }] }));

type Profile = { bio: string | null; rate: number | null };
declare const profile: Profile | null;
expectType<ChecklistItem[]>(filled(profile, { bio: "About", rate: "Rate" }));
expectError(filled(profile, { bio: "About", rte: "Rate" }));
expectError<DrawerTabWidgets>({ key: "a", label: "A", widgets: [checklist({ items: [] })] });
