import { missing } from "../../internal/validate-shared";
import type { ColumnFormat, FilterType, ResourceConfig } from "../../types/resource";

const FILTER_TYPES = {
  text: true,
  select: true,
  multiselect: true,
  daterange: true,
  "numeric-range": true,
  boolean: true,
  tag: true,
} satisfies Record<FilterType, true>;

const FORMATS = {
  badge: true,
  money: true,
  number: true,
  date: true,
  relative: true,
  percent: true,
  duration: true,
  boolean: true,
  url: true,
} satisfies Record<Extract<ColumnFormat, string>, true>;

const FORMAT_KINDS = {
  badge: true,
  money: true,
  number: true,
  date: true,
  percent: true,
  duration: true,
  boolean: true,
  url: true,
} satisfies Record<Extract<ColumnFormat, object>["kind"], true>;

function check(site: string, kind: string, value: string, known: object): void {
  if (!Object.hasOwn(known, value)) missing(site, kind, value, Object.keys(known));
}

function checkFormat(site: string, format: unknown): void {
  if (typeof format === "string") {
    check(site, "column format", format, FORMATS);
    return;
  }
  if (!format || typeof format !== "object") return;
  const kind: unknown = Reflect.get(format, "kind");
  if (typeof kind === "string") check(`${site}.kind`, "column format", kind, FORMAT_KINDS);
}

/** Throws on a filter `type` or column `format` the admin cannot render, which only TypeScript catches otherwise. */
export function validateDeclaredKinds(name: string, resource: ResourceConfig): void {
  resource.options.filters?.forEach((filter: unknown, index: number) => {
    if (!filter || typeof filter !== "object") return;
    const type: unknown = Reflect.get(filter, "type");
    if (typeof type === "string") {
      check(`resource "${name}" filters[${index}].type`, "filter type", type, FILTER_TYPES);
    }
  });
  resource.options.columns?.forEach((column: unknown, index: number) => {
    if (!column || typeof column !== "object") return;
    checkFormat(`resource "${name}" columns[${index}].format`, Reflect.get(column, "format"));
  });
}
