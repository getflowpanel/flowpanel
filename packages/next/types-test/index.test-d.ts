import type { FormActionResult } from "@flowpanel/next";
import { expectAssignable, expectError } from "tsd";

expectAssignable<FormActionResult>({ ok: true, createdKey: "user-42" });
expectError<FormActionResult>({ ok: true, createdKey: 42 });
