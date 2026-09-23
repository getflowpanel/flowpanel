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
