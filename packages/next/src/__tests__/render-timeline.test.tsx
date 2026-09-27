import type {
  RequestContext,
  ResolvedAdminConfig,
  TimelineEvent,
  TimelinePage,
} from "@flowpanel/core";
import { mergeLabels, RU_LABELS, timeline } from "@flowpanel/core";
import { TimelineCard, type TimelineCardProps } from "@flowpanel/react";
import type { ReactElement } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { renderTimeline } from "../runtime/render-timeline";
import { fakeWidgetContext } from "./widget-context-fixture";

const cfg = {
  basePath: "/admin",
  resourcesByName: new Map(),
  __resolved: true,
} as unknown as ResolvedAdminConfig;
const reqCtx = {
  req: new Request("http://localhost/admin"),
  session: null,
  role: "admin",
  scope: null,
  ip: null,
  userAgent: null,
} as RequestContext;

const EVENTS: TimelineEvent[] = [
  { at: new Date("2026-09-25T11:00:00Z"), kind: "visit", title: "Opened the feed", href: "/f/2" },
  { at: new Date("2026-09-25T10:00:00Z"), kind: "visit", title: "Opened the feed", href: "/f/1" },
  {
    at: new Date("2026-09-24T09:00:00Z"),
    kind: "reply",
    title: "Sent a reply",
    meta: "Kwork",
    body: "Hello",
    href: "/admin/response/r1",
  },
  { at: new Date("2026-09-20T09:00:00Z"), kind: "visit", title: "Opened the feed" },
];
const pages: TimelinePage[] = [];
const widget = timeline({
  label: "Activity",
  id: "activity",
  pageSize: 2,
  kinds: { visit: ["Visit", "info"], reply: ["Reply", "ok"] },
  query: async (_ctx, page) => {
    pages.push(page);
    return EVENTS.filter((e) => page.before === null || e.at.getTime() <= page.before.getTime());
  },
});

async function card(query: string, events = widget): Promise<TimelineCardProps> {
  const ctx = fakeWidgetContext({
    req: new Request(`http://localhost/admin/users/u1?tab=activity${query}`),
    dateRange: {
      from: new Date(0),
      to: new Date(),
      preset: "custom",
      previous: null,
      timeZone: "UTC",
    },
  });
  const node = (await renderTimeline(events, ctx, cfg, reqCtx)) as ReactElement<TimelineCardProps>;
  expect(node.type).toBe(TimelineCard);
  return node.props;
}

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-25T12:00:00Z"));
});
afterAll(() => vi.useRealTimers());

describe("renderTimeline", () => {
  it("groups the newest page by day and folds repeated lines", async () => {
    const props = await card("");
    expect(pages.at(-1)).toEqual({ before: null, limit: 3, kinds: null });
    expect(props.groups).toHaveLength(1);
    expect(props.groups[0]).toMatchObject({ key: "2026-09-25", label: "Today", count: "2 events" });
    expect(props.groups[0]?.lines[0]).toMatchObject({
      title: "Opened the feed",
      folded: "×2",
      span: "10:00–11:00",
      tone: "info",
    });
    expect(props.groups[0]?.lines[0]?.href).toBeUndefined();
    expect(props.groups[0]?.lines[0]?.items?.map((item) => item.href)).toEqual(["/f/2", "/f/1"]);
    expect(props.older).toEqual({
      label: "Older",
      href: "/admin/users/u1?tab=activity&activity.before=2026-09-25T10%3A00%3A00.000Z%7E1",
    });
    expect(props.newest).toBeUndefined();
  });

  it("pages older from the cursor and links back to the newest page", async () => {
    const props = await card("&activity.before=2026-09-25T10%3A00%3A00.000Z%7E1");
    expect(pages.at(-1)).toEqual({
      before: new Date("2026-09-25T10:00:00Z"),
      limit: 4,
      kinds: null,
    });
    const ctx = fakeWidgetContext();
    expect(props.groups.map((g) => g.label)).toEqual(["Yesterday", ctx.format.date("2026-09-20")]);
    expect(props.groups[0]?.lines[0]).toMatchObject({
      title: "Sent a reply",
      meta: "Kwork",
      body: "Hello",
      href: "/admin/response/r1",
      tone: "ok",
    });
    expect(props.newest).toEqual({ label: "Newest", href: "/admin/users/u1?tab=activity" });
  });

  it("reads only the picked kind and marks its chip", async () => {
    const props = await card("&activity.kind=reply");
    expect(pages.at(-1)?.kinds).toEqual(["reply"]);
    expect(props.chips).toEqual([
      { key: "", label: "All", href: "/admin/users/u1?tab=activity", current: false },
      {
        key: "visit",
        label: "Visit",
        href: "/admin/users/u1?tab=activity&activity.kind=visit",
        current: false,
      },
      {
        key: "reply",
        label: "Reply",
        href: "/admin/users/u1?tab=activity&activity.kind=reply",
        current: true,
      },
    ]);
    expect(props.groups.flatMap((g) => g.lines)).toHaveLength(1);
  });

  it("prefers the locale's plurals.events over timeline.event/events", async () => {
    const ctx = fakeWidgetContext({
      req: new Request("http://localhost/admin/users/u1?tab=activity"),
      dateRange: {
        from: new Date(0),
        to: new Date(),
        preset: "custom",
        previous: null,
        timeZone: "UTC",
      },
      labels: mergeLabels({}, RU_LABELS),
    });
    const node = (await renderTimeline(
      widget,
      ctx,
      cfg,
      reqCtx,
    )) as ReactElement<TimelineCardProps>;
    expect(node.props.groups[0]).toMatchObject({ count: "2 события" });
  });

  it("falls back to the default page size for a non-finite pageSize", async () => {
    const props = await card(
      "",
      timeline({
        id: "activity",
        pageSize: Number.NaN,
        kinds: { visit: ["Visit", "info"], reply: ["Reply", "ok"] },
        query: async () => EVENTS,
      }),
    );
    expect(props.groups).toHaveLength(3);
    expect(props.older).toBeUndefined();
  });

  it("shows the empty state when nothing happened", async () => {
    const props = await card(
      "",
      timeline({ kinds: { visit: "Visit" }, emptyState: "Nothing yet", query: async () => [] }),
    );
    expect(props.groups).toEqual([]);
    expect(props.emptyState).toBe("Nothing yet");
  });
});
