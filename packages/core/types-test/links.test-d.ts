import {
  bars,
  type DashboardLink,
  type Link,
  type LinkTarget,
  list,
  metric,
  type ResourceLink,
  stat,
  table,
  type WidgetContext,
} from "@flowpanel/core";
import { expectAssignable, expectError, expectNotAssignable, expectType } from "tsd";

expectAssignable<ResourceLink>({ resource: "users", view: "Errors", filter: { email: "a@b.co" } });
expectAssignable<DashboardLink>({ dashboard: "/system", range: false });
expectAssignable<LinkTarget>("https://status.example.com");
expectNotAssignable<LinkTarget>({ view: "Errors" });
expectAssignable<Link>((ctx: WidgetContext) => ({ resource: "users", id: ctx.id ?? "" }));

declare const ctx: WidgetContext;
expectType<string>(ctx.link({ dashboard: "/system" }));

metric("Signups", async () => 1, { drilldown: { resource: "users" } });
stat("Health", 1, { href: (c) => (c.row ? null : { dashboard: "/system" }) });
list({
  query: async () => [
    { text: "Failing", href: { resource: "users", filter: { email: "a@b.co" } } },
  ],
});
bars({ query: async () => [{ label: "kwork", value: 3, href: { dashboard: "/parsing" } }] });
table({
  query: async () => [{ id: "r1" }],
  seeAll: { resource: "users" },
  rowHref: (row) => ({ resource: "users", id: row.id }),
});
expectError(metric("Signups", async () => 1, { drilldown: { resource: "users", id: { n: 1 } } }));
expectAssignable<LinkTarget>({
  resource: "users",
  filter: { id: { gte: 1 }, email: ["a@b.co", "c@d.co"] },
  range: "id",
});
expectError<LinkTarget>({ resource: "users", filter: { emial: "a@b.co" } });
expectError<LinkTarget>({ resource: "users", range: "createdAt" });
expectAssignable<ResourceLink>({ resource: "visits", filter: { userId: 1 }, range: "startedAt" });
expectAssignable<LinkTarget>({
  resource: "visits",
  filter: { userId: { op: "in", values: ["1"] } },
});
expectError<LinkTarget>({ resource: "visits", filter: { usrId: 1 } });
expectError(
  metric("x", async () => 1, { drilldown: { resource: "users", filter: { emial: "a" } } }),
);
