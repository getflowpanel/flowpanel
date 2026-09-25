import {
  type ColumnFormat,
  type EnumDef,
  enumOf,
  type SelectOption,
  type Tone,
} from "@flowpanel/core";
import { expectAssignable, expectError, expectType } from "tsd";

declare const planValues: ["free", "starter", "pro"];

const Plan = enumOf(planValues, {
  free: ["Free", "muted"],
  starter: "Starter",
  pro: { label: "Pro", tone: "accent" },
});
expectType<EnumDef<"free" | "starter" | "pro">>(Plan);
expectType<readonly ("free" | "starter" | "pro")[]>(Plan.values);
expectType<string>(Plan.label(null));
expectType<Tone>(Plan.tone("pro"));
expectType<{ label: string; tone: Tone } | null>(Plan.badge("pro"));
expectAssignable<ColumnFormat>(Plan.format);
expectAssignable<SelectOption[]>(Plan.options);

expectError(enumOf(planValues, { free: "Free", starter: "Starter" }));
expectError(enumOf(planValues, { free: "Free", starter: "Starter", pro: "Pro", gold: "Gold" }));
expectError(enumOf({ a: ["A", "blue"] }));

const Role = enumOf({ admin: "Admin", user: ["User", "muted"] });
expectType<EnumDef<"admin" | "user">>(Role);
