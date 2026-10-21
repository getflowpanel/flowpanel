import type { ResolvedFormatting } from "@flowpanel/core";
import { expectAssignable } from "tsd";

expectAssignable<ResolvedFormatting>({
  locale: "en-US",
  dateLocale: "en-CA",
  timeZone: "UTC",
  currency: "USD",
});
