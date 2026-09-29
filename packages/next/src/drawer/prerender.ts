import type { RequestContext } from "@flowpanel/core";
import { createElement, Fragment, isValidElement, type ReactNode } from "react";
import type { FieldRender } from "./serialize-fields";

let renderToStaticMarkupFn: ((node: ReactNode) => string) | null = null;
async function getRenderToStaticMarkup(): Promise<(node: ReactNode) => string> {
  if (!renderToStaticMarkupFn) {
    // @ts-expect-error -- runtime export exists; ./server declarations don't resolve here
    const mod = (await import("react-dom/server")) as {
      renderToStaticMarkup: (node: ReactNode) => string;
    };
    renderToStaticMarkupFn = mod.renderToStaticMarkup;
  }
  return renderToStaticMarkupFn;
}

const CLIENT_REFERENCE = Symbol.for("react.client.reference");

/** True when a node holds a client component, which only the page's RSC render can draw. */
export function holdsClientComponent(node: unknown): boolean {
  if (Array.isArray(node)) return node.some(holdsClientComponent);
  if (!isValidElement(node)) return false;
  const type = node.type as { $$typeof?: unknown } | string;
  if (typeof type !== "string" && type?.$$typeof === CLIENT_REFERENCE) return true;
  return Object.values(node.props as Record<string, unknown>).some(holdsClientComponent);
}

/** Every column `render` of `columns`, keyed by its field. */
export function columnRenders(columns: ReadonlyArray<unknown>): Map<string, FieldRender> {
  const out = new Map<string, FieldRender>();
  for (const c of columns) {
    if (typeof c !== "object" || c === null) continue;
    const { field, render } = c as { field?: unknown; render?: unknown };
    if (typeof field === "string" && typeof render === "function") {
      out.set(field, render as FieldRender);
    }
  }
  return out;
}

/**
 * Each render's output as static HTML, keyed by field; one that throws is logged and left out,
 * one that returns a client component is left out quietly for the list's own cell to stand in.
 */
export async function prerenderEach(
  renders: Map<string, FieldRender>,
  row: Record<string, unknown>,
  reqCtx: RequestContext,
): Promise<Record<string, string>> {
  if (renders.size === 0) return {};
  const renderToStaticMarkup = await getRenderToStaticMarkup();
  const entries = await Promise.all(
    [...renders].map(async ([name, render]): Promise<[string, string] | null> => {
      try {
        const node = await render(row as never, reqCtx);
        if (holdsClientComponent(node)) return null;
        return [name, renderToStaticMarkup(createElement(Fragment, null, node))];
      } catch (error) {
        console.error(`[flowpanel] drawer render failed for "${name}"`, error);
        return null;
      }
    }),
  );
  return Object.fromEntries(entries.filter((entry) => entry !== null));
}

/** Column and field renders side by side; a field render wins, and one that throws leaves the column's. */
export async function prerenderDrawerCells(
  columns: ReadonlyArray<unknown>,
  fields: Map<string, FieldRender>,
  row: Record<string, unknown>,
  reqCtx: RequestContext,
): Promise<Record<string, string>> {
  const [fromColumns, fromFields] = await Promise.all([
    prerenderEach(columnRenders(columns), row, reqCtx),
    prerenderEach(fields, row, reqCtx),
  ]);
  return { ...fromColumns, ...fromFields };
}
