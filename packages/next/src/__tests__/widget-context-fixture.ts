import type { LinkTarget, WidgetContext } from "@flowpanel/core";
import { bindFormat, DEFAULT_FORMATTING, DEFAULT_LABELS } from "@flowpanel/core";

type Thunk = () => Promise<unknown>;
type Call = (...args: unknown[]) => Promise<unknown>;

function runQuery<T>(key: string, fn: () => Promise<T>): Promise<T>;
function runQuery<A extends unknown[], T>(fn: (...args: A) => Promise<T>, ...args: A): Promise<T>;
function runQuery(first: string | Call, ...rest: unknown[]): Promise<unknown> {
  return typeof first === "string" ? (rest[0] as Thunk)() : first(...rest);
}

function fakeLink(target: LinkTarget): string {
  if (typeof target === "string") return target;
  return "resource" in target ? `/admin/${target.resource}` : `/admin${target.dashboard}`;
}

/** A widget context for render tests: no memo, no database, links under `/admin`. */
export function fakeWidgetContext(overrides: Partial<WidgetContext> = {}): WidgetContext {
  return {
    db: {},
    session: null,
    dateRange: {
      from: new Date(0),
      to: new Date(),
      preset: "custom",
      previous: null,
      timeZone: "UTC",
    },
    req: new Request("http://localhost/"),
    href: (resource, id) =>
      id === undefined ? `/admin/${resource}` : `/admin/${resource}/${String(id)}`,
    link: fakeLink,
    query: runQuery,
    labels: DEFAULT_LABELS,
    format: bindFormat(DEFAULT_FORMATTING),
    sql: async () => [],
    count: async () => 0,
    ...overrides,
  };
}
