import {
  DE_LABELS,
  DEFAULT_LABELS,
  ES_LABELS,
  FR_LABELS,
  mergeLabels,
  PT_BR_LABELS,
  RU_LABELS as rootLabels,
} from "@flowpanel/core";
import {
  formatCount,
  type LabelsConfig,
  type PluralLabel,
  type ResolvedLabels,
  RU_LABELS,
} from "@flowpanel/core/labels";
import { expectAssignable, expectError, expectType } from "tsd";

expectType<ResolvedLabels>(RU_LABELS);
expectType<ResolvedLabels>(rootLabels);
expectType<ResolvedLabels>(DE_LABELS);
expectType<ResolvedLabels>(FR_LABELS);
expectType<ResolvedLabels>(ES_LABELS);
expectType<ResolvedLabels>(PT_BR_LABELS);
expectAssignable<LabelsConfig>(mergeLabels({ actions: { new: "Hinzufügen" } }, DE_LABELS));
expectAssignable<LabelsConfig>(RU_LABELS);
expectType<string>(RU_LABELS.dateRange.today);
expectType<string>(RU_LABELS.navigation.accountMenu);
expectType<string>(RU_LABELS.related.openList);
expectType<string>(RU_LABELS.detail.unknownResource);

expectType<string>(DEFAULT_LABELS.table.results);
expectType<string>(DEFAULT_LABELS.table.result);
expectType<string>(DEFAULT_LABELS.bulkBar.selected);
expectAssignable<LabelsConfig>({
  plurals: { results: { one: "{n} запись", few: "{n} записи", other: "{n} записей" } },
  bulkBar: { selected: "Выбрано: {n}" },
});
expectError<LabelsConfig>({ table: { results: { other: "{n}" } } });
expectType<string>(formatCount({ other: "{n}" } satisfies PluralLabel, 3, "ru-RU"));
expectType<string>(DEFAULT_LABELS.access.signInTitle);
expectType<string>(RU_LABELS.access.deniedDescription);
expectAssignable<LabelsConfig>({ access: { deniedTitle: "Нет доступа" } });
expectError<LabelsConfig>({ access: { deniedTitle: 403 } });
