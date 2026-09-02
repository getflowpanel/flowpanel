import type {
  AdminShellProps,
  DataTableProps,
  FormActionResult,
  MobileCardListProps,
} from "@flowpanel/react";
import { expectAssignable, expectError } from "tsd";

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
