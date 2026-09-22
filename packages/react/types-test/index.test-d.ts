import type {
  AdminShellProps,
  DataTableProps,
  FormActionResult,
  HealthBannerProps,
  MobileCardListProps,
} from "@flowpanel/react";
import { formatNumber } from "@flowpanel/react";
import { expectAssignable, expectError, expectType } from "tsd";

type User = { id: string; email: string };

expectAssignable<FormActionResult>({ ok: true, createdKey: "user-42" });
expectError<FormActionResult>({ ok: true, createdKey: 42 });

expectAssignable<Pick<DataTableProps<User>, "enteringRowKeys">>({
  enteringRowKeys: ["user-42"],
});
expectError<Pick<DataTableProps<User>, "enteringRowKeys">>({ enteringRowKeys: [42] });

expectAssignable<Pick<MobileCardListProps<User>, "enteringRowKeys">>({
  enteringRowKeys: ["user-42"],
});
expectError<Pick<MobileCardListProps<User>, "enteringRowKeys">>({ enteringRowKeys: [42] });

expectAssignable<Pick<AdminShellProps, "showSkipLink">>({ showSkipLink: false });
expectError<Pick<AdminShellProps, "showSkipLink">>({ showSkipLink: "false" });

// formatNumber's third argument: the resolved formatting, or 0.2's bare locale
expectType<string>(
  formatNumber(12, "currency", {
    locale: "de-DE",
    dateLocale: "de-DE",
    timeZone: "UTC",
    currency: "EUR",
  }),
);
expectType<string>(formatNumber(12, "currency", "de-DE"));
expectError(formatNumber(12, "currency", { locale: "de-DE" }));

// the health banner speaks the shared Tone vocabulary
expectAssignable<Pick<HealthBannerProps, "tone">>({ tone: "err" });
expectError<Pick<HealthBannerProps, "tone">>({ tone: "error" });
