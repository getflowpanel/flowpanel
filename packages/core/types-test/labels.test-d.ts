import { RU_LABELS as rootLabels } from "@flowpanel/core";
import { type LabelsConfig, type ResolvedLabels, RU_LABELS } from "@flowpanel/core/labels";
import { expectAssignable, expectType } from "tsd";

expectType<ResolvedLabels>(RU_LABELS);
expectType<ResolvedLabels>(rootLabels);
expectAssignable<LabelsConfig>(RU_LABELS);
expectType<string>(RU_LABELS.dateRange.today);
expectType<string>(RU_LABELS.navigation.accountMenu);
