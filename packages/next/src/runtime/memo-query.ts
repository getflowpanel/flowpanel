import type { WidgetContext } from "@flowpanel/core";
import { callKey } from "./memo-key";
import { noteMemoHit } from "./widget-owner";

type Thunk = () => Promise<unknown>;
type Call = (...args: unknown[]) => Promise<unknown>;

/**
 * `ctx.query`: one run per key, or per function and arguments, for the life of one context.
 * A function passed alone that declares a parameter receives the context.
 */
export function memoQuery(
  memo: Map<string, Promise<unknown>>,
  self: () => WidgetContext,
): WidgetContext["query"] {
  function query<T>(key: string, fn: () => Promise<T>): Promise<T>;
  function query<A extends unknown[], T>(fn: (...args: A) => Promise<T>, ...args: A): Promise<T>;
  function query<T>(fn: (ctx: WidgetContext) => Promise<T>): Promise<T>;
  function query(first: unknown, ...rest: unknown[]): Promise<unknown> {
    const fn = first as Call;
    const key = typeof first === "string" ? `k:${first}` : callKey(fn, rest);
    const running = memo.get(key);
    if (running) {
      noteMemoHit();
      return running;
    }
    const started =
      typeof first === "string"
        ? (rest[0] as Thunk)()
        : rest.length === 0 && fn.length > 0
          ? fn(self())
          : fn(...rest);
    memo.set(key, started);
    return started;
  }
  return query;
}
