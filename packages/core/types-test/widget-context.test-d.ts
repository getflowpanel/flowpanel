import type { WidgetContext } from "@flowpanel/core";
import { expectError, expectType } from "tsd";

declare const ctx: WidgetContext;

expectType<string | undefined>(ctx.id);
expectType<Promise<string>>(ctx.query("k", async () => "v"));
expectType<Promise<number>>(ctx.query(async (a: number, b: string) => a + b.length, 1, "x"));
expectType<Promise<boolean>>(ctx.query(async () => true));
expectError(ctx.query(async (a: number) => a, "not a number"));
expectType<Promise<number>>(ctx.count("users"));
expectType<{ from: Date; to: Date } | null>(ctx.dateRange.previous);
expectType<string>(ctx.dateRange.timeZone);
expectType<string>(ctx.format.percent(0.4));
expectType<string>(ctx.format.plural(3, { one: "{n} run", other: "{n} runs" }));
expectType<string>(ctx.format.dateTime(null));
expectType<Promise<{ id: number; email: string }[]>>(ctx.read("users"));
expectType<Promise<{ id: number; email: string }[]>>(
  ctx.read("users", {
    where: { email: "a@b.co", id: { gte: 1 } },
    sort: { field: "id", dir: "desc" },
    limit: 5,
    fields: ["email"],
  }),
);
expectError(ctx.read("users", { where: { emial: "a@b.co" } }));
expectError(ctx.read("users", { sort: { field: "name", dir: "asc" } }));
expectError(ctx.read("users", { where: { id: { gte: "one" } } }));
expectError(ctx.read("users", { where: { id: [false] } }));
expectType<Promise<number>>(ctx.count("users", { email: "a@b.co" }, { range: "id" }));
expectType<Promise<number>>(ctx.count("users", { id: ["1", "2"] }));
expectError(ctx.count("users", { emial: "a@b.co" }));
expectError(ctx.count("users", {}, { range: "createdAt" }));
expectType<Promise<{ id: number; email: string }[]>>(ctx.read("users", { range: "id" }));
expectError(ctx.read("users", { range: "createdAt" }));

declare const target: "users" | "visits";
expectType<Promise<number>>(ctx.count(target, { userId: 1 }));
expectError(ctx.count(target, { usrId: 1 }));
expectType<Promise<number>>(ctx.count("users", { email: { op: "in", values: ["a@b.co"] } }));
expectType<Promise<number>>(ctx.count("visits", { startedAt: { op: "range", gte: new Date(0) } }));

declare function hourly(ctx: WidgetContext): Promise<{ at: Date; runs: number }[]>;
expectType<Promise<{ at: Date; runs: number }[]>>(ctx.query(hourly));
expectType<Promise<boolean>>(ctx.query(async () => true));
expectType<Promise<number>>(ctx.query(async (limit: number = 5) => limit));
ctx.query(async (limit = 5) => limit);
expectError(ctx.query(async (a: number) => a));
