import { describe, expect, it } from "vitest";
import {
  DE_LABELS,
  DEFAULT_LABELS,
  ES_LABELS,
  FR_LABELS,
  formatCount,
  mergeLabels,
  PT_BR_LABELS,
  type ResolvedLabels,
  RU_LABELS,
} from "../index";
import { ENGLISH_LABELS } from "./english-labels";

type Tree = string | { [key: string]: Tree };

function paths(tree: Tree, prefix = ""): Map<string, string> {
  if (typeof tree === "string") return new Map([[prefix, tree]]);
  return new Map(
    Object.entries(tree).flatMap(([key, value]) => [
      ...paths(value, prefix ? `${prefix}.${key}` : key),
    ]),
  );
}

/** Codes, symbols and templates that read the same in every language. */
const SAME_EVERYWHERE = [
  "detail.tabCount",
  "timeline.folded",
  "checklist.gap",
  "audit.record",
  "audit.actionOption",
  "heatmap.cell",
  "fields.id",
];

/** Words a language shares with English. */
const PRESETS: Array<{ name: string; labels: ResolvedLabels; same: string[] }> = [
  {
    name: "de",
    labels: DE_LABELS,
    same: [
      "navigation.title",
      "navigation.dashboards",
      "detail.details",
      "errors.details",
      "checklist.optional",
      "shortcuts.navigation",
      "realtime.live",
      "realtime.offline",
    ],
  },
  {
    name: "fr",
    labels: FR_LABELS,
    same: [
      "navigation.notifications",
      "navigation.title",
      "navigation.pages",
      "table.actions",
      "pagination.label",
      "pagination.page",
      "palette.suggestions",
      "shortcuts.navigation",
      "audit.action",
      "audit.date",
      "table.compact",
      "bulkBar.choose",
    ],
  },
  {
    name: "es",
    labels: ES_LABELS,
    same: ["filters.no", "widget.tones.err", "errors.digest", "shortcuts.general"],
  },
  {
    name: "pt-BR",
    labels: PT_BR_LABELS,
    same: ["filters.tagsPlaceholder", "navigation.dashboards"],
  },
  {
    name: "ru",
    labels: RU_LABELS,
    same: ["pagination.pageSize", "widget.points"],
  },
];

const PLURAL_FORMS = /\.(zero|one|two|few|many|other)$/;

describe.each(PRESETS)("the $name preset", ({ labels, same }) => {
  const { plurals: _en, ...english } = ENGLISH_LABELS;
  const { plurals, ...translated } = labels;
  const en = paths(english as unknown as Tree);
  const own = paths(translated as unknown as Tree);
  const pluralBase = (path: string) => path.replace(PLURAL_FORMS, "");

  it("is plain data that merges like a host's own labels", () => {
    expect(JSON.parse(JSON.stringify(labels))).toEqual(labels);
    expect(mergeLabels(labels)).toEqual(labels);
  });

  it("translates every key the English chrome has, and no more", () => {
    const enBases = new Set([...en.keys()].map(pluralBase));
    expect([...en.keys()].filter((path) => !own.has(path) && !PLURAL_FORMS.test(path))).toEqual([]);
    expect([...own.keys()].filter((path) => !enBases.has(pluralBase(path)))).toEqual([]);
  });

  it("leaves no English string untranslated", () => {
    const allowed = new Set([...SAME_EVERYWHERE, ...same]);
    const left = [...en].filter(([path, text]) => own.get(path) === text).map(([path]) => path);
    expect(left.filter((path) => !allowed.has(path))).toEqual([]);
  });

  it("keeps every placeholder the English string fills", () => {
    const names = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const lost = [...own]
      .filter(([path, text]) => {
        const source = names(en.get(path) ?? en.get(`${pluralBase(path)}.other`) ?? "");
        if (path.endsWith(".zero")) return names(text).some((name) => !source.includes(name));
        return source.join() !== names(text).join();
      })
      .map(([path]) => path);
    expect(lost).toEqual([]);
  });

  it("gives every count the plural forms its language has, and may add a zero", () => {
    const categories = new Intl.PluralRules(labels.dateRange.locale).resolvedOptions()
      .pluralCategories;
    const counts = [
      ...Object.values(plurals ?? {}),
      labels.importer.rows,
      labels.importer.imported,
      labels.importer.rejected,
    ];
    for (const count of counts) {
      const forms = typeof count === "object" ? Object.keys(count) : [count];
      const extraZero = !categories.includes("zero") ? ["zero"] : [];
      expect(forms.filter((form) => !extraZero.includes(form)).sort()).toEqual(
        [...categories].sort(),
      );
    }
  });
});

describe("plural forms picked by Intl.PluralRules", () => {
  const results = (labels: ResolvedLabels, n: number) =>
    formatCount(
      labels.plurals?.results ?? (n === 1 ? labels.table.result : labels.table.results),
      n,
      labels.dateRange.locale,
      new Intl.NumberFormat(labels.dateRange.locale).format(n),
    );

  it("reads 0 as singular in French, as none in Brazilian Portuguese, and as plural in Spanish and German", () => {
    expect([0, 1, 2].map((n) => results(FR_LABELS, n))).toEqual([
      "0 résultat",
      "1 résultat",
      "2 résultats",
    ]);
    expect([0, 1, 2].map((n) => results(PT_BR_LABELS, n))).toEqual([
      "Nenhum resultado",
      "1 resultado",
      "2 resultados",
    ]);
    expect([0, 1, 2].map((n) => results(ES_LABELS, n))).toEqual([
      "0 resultados",
      "1 resultado",
      "2 resultados",
    ]);
    expect([0, 1, 2].map((n) => results(DE_LABELS, n))).toEqual([
      "0 Ergebnisse",
      "1 Ergebnis",
      "2 Ergebnisse",
    ]);
  });

  it("puts de before a noun counted in millions, as French, Spanish and Portuguese write it", () => {
    expect(results(FR_LABELS, 1_000_000)).toBe("1 000 000 de résultats");
    expect(results(ES_LABELS, 1_000_000)).toBe("1.000.000 de resultados");
    expect(results(PT_BR_LABELS, 2_000_000)).toBe("2.000.000 de resultados");
    expect(results(ES_LABELS, 1_500)).toBe("1500 resultados");
  });

  it("takes an explicit zero form for a count of 0 only", () => {
    const rejected = PT_BR_LABELS.importer.rejected;
    expect([0, 1, 3].map((n) => formatCount(rejected, n, "pt-BR"))).toEqual([
      "Nenhuma linha recusada",
      "1 linha não importada",
      "3 linhas não importadas",
    ]);
    expect(formatCount(DEFAULT_LABELS.importer.imported, 0, "en-US")).toBe("0 rows imported");
  });
});
