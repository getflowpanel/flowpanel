import {
  type DrawerTabWidgets,
  enumOf,
  type TimelineEvent,
  type TimelinePage,
  timeline,
} from "@flowpanel/core";
import { expectAssignable, expectError, expectType } from "tsd";

const Kinds = enumOf({ visit: ["Visit", "info"], reply: "Reply" });

timeline({
  kinds: Kinds,
  query: async (_c, page) => {
    expectType<TimelinePage>(page);
    return [{ at: new Date(), kind: "visit", title: "Opened the feed" }];
  },
});
timeline({ kinds: { visit: "Visit" }, group: false, pageSize: 20, id: "t", span: 6 });
expectError(timeline({ kinds: Kinds, group: "week" }));
expectAssignable<TimelineEvent>({
  at: new Date(),
  kind: "visit",
  title: "x",
  href: { resource: "users", id: 1 },
});
expectError<TimelineEvent>({ at: "2026-09-25", kind: "visit", title: "x" });
expectError<DrawerTabWidgets>({ key: "a", label: "A", widgets: [timeline({ kinds: Kinds })] });
timeline({
  kinds: Kinds,
  sources: [
    timeline.source("visits", {
      kind: "visit",
      at: "startedAt",
      refs: ["userId"],
      title: (v, refs) => `${v.userId} ${refs.userId ?? ""}`,
      where: { userId: 1 },
    }),
    timeline.source("visits", { kind: { field: "userId" }, at: "startedAt" }),
    timeline.source("visits", { kind: "visit", at: "startedAt", by: "userId" }),
  ],
});
expectError(timeline.source("visits", { kind: "visit", at: "startedat" }));
expectError(timeline.source("visits", { kind: "visit", at: "startedAt", by: "usrId" }));
expectError(timeline.source("visits", { kind: { field: "knd" }, at: "startedAt" }));
expectError(timeline.source("visits", { kind: "visit", at: "startedAt", where: { usrId: 1 } }));
