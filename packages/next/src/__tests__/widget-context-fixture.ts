import type { LinkTarget, WidgetContext } from "@flowpanel/core";
import { bindFormat, DEFAULT_FORMATTING, DEFAULT_LABELS } from "@flowpanel/core";

type Thunk = () => Promise<unknown>;
type Call = (...args: unknown[]) => Promise<unknown>;

function runQuery(self: () => WidgetContext): WidgetContext["query"] {
  return ((first: string | Call, ...rest: unknown[]) =>
    typeof first === "string"
      ? (rest[0] as Thunk)()
      : rest.length === 0 && first.length > 0
        ? first(self())
        : first(...rest)) as WidgetContext["query"];
}

function fakeLink(target: LinkTarget): string {
  if (typeof target === "string") return target;
  return "resource" in target ? `/admin/${target.resource}` : `/admin${target.dashboard}`;
}

/** A widget context for render tests: no memo, no database, links under `/admin`. */
export function fakeWidgetContext(overrides: Partial<WidgetContext> = {}): WidgetContext {
  const ctx: WidgetContext = {
    db: {},
    session: null,
    dateRange: {
      from: new Date(0),
      to: new Date(),
      preset: "custom",
      previous: null,
      timeZone: "UTC",
    },
    filters: {},
    req: new Request("http://localhost/"),
    href: (resource, id) =>
      id === undefined ? `/admin/${resource}` : `/admin/${resource}/${String(id)}`,
    link: fakeLink,
    query: runQuery(() => ctx),
    labels: DEFAULT_LABELS,
    format: bindFormat(DEFAULT_FORMATTING),
    sql: async () => [],
    count: async () => 0,
    read: async () => [],
    rowOf: (() => {
      throw new Error("fakeWidgetContext: no record; pass rowOf in the overrides");
    }) as WidgetContext["rowOf"],
    ...overrides,
  };
  return ctx;
}
