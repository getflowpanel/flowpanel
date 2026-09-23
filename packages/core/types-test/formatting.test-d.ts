import { type ResolvedFormatting, resolveFormatting } from "@flowpanel/core";
import { expectAssignable, expectType } from "tsd";

expectType<"config" | "default" | undefined>(resolveFormatting().timeZoneSource);
expectAssignable<ResolvedFormatting>({
  locale: "en-US",
  dateLocale: "en-CA",
  timeZone: "UTC",
  currency: "USD",
});
