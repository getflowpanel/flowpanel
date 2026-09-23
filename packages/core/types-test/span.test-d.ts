import { type Span, stat } from "@flowpanel/core";
import { expectAssignable, expectError, expectNotAssignable } from "tsd";

expectAssignable<Span>(5);
expectAssignable<Span>(7);
expectAssignable<Span>(11);
expectNotAssignable<Span>(0);
expectNotAssignable<Span>(13);
stat("Paid", 3, { span: 5 });
expectError(stat("Paid", 3, { span: 13 }));
