/** What the list shows with nothing in its URL, so a view equal to it is recognised. */
export interface ListDefaults {
  filters?: Record<string, string>;
  sort?: { field: string; dir: "asc" | "desc" };
}

/** Wire-safe shape of a saved view passed from the server. */
export interface SavedView {
  name: string;
  description?: string;
  filters?: Record<string, unknown>;
  sort?: { field: string; dir: "asc" | "desc" };
  search?: string;
  /** "static" views come from the resource config; "user" views live in localStorage. */
  source: "static" | "user";
}

/** The query keys a view sets; the rest of the URL (page size, the drawer) stays. */
export const LIST_KEYS = /^(f_.+|q|sort|page)$/;

export type ListState = { filters: Record<string, string>; sort: string; search: string };

/** One comparable form of a list's state: defaults filled in, cleared filters dropped. */
export function stateKey(state: ListState, defaults: ListDefaults | undefined): string {
  const filters: Record<string, string> = {};
  for (const [field, value] of Object.entries(defaults?.filters ?? {})) filters[field] = value;
  for (const [field, value] of Object.entries(state.filters)) filters[field] = value;
  const kept = Object.entries(filters)
    .filter(([, value]) => value !== "")
    .sort(([a], [b]) => a.localeCompare(b));
  const fallbackSort = defaults?.sort ? `${defaults.sort.field}:${defaults.sort.dir}` : "";
  return JSON.stringify([kept, state.sort || fallbackSort, state.search]);
}

export function urlState(params: URLSearchParams): ListState {
  const filters: Record<string, string> = {};
  for (const [key, value] of params) if (key.startsWith("f_")) filters[key.slice(2)] = value;
  return { filters, sort: params.get("sort") ?? "", search: params.get("q") ?? "" };
}

export function viewState(view: Omit<SavedView, "source">): ListState {
  const filters: Record<string, string> = {};
  for (const [field, value] of Object.entries(view.filters ?? {})) {
    if (value !== undefined && value !== null) filters[field] = String(value);
  }
  return {
    filters,
    sort: view.sort ? `${view.sort.field}:${view.sort.dir}` : "",
    search: view.search ?? "",
  };
}

const LS_PREFIX = "flowpanel:views";

export function loadUserViews(resource: string): Array<Omit<SavedView, "source">> {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(`${LS_PREFIX}:${resource}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Array<Omit<SavedView, "source">>;
  } catch {
    return [];
  }
}

export function persistUserViews(
  resource: string,
  views: ReadonlyArray<Omit<SavedView, "source">>,
): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(`${LS_PREFIX}:${resource}`, JSON.stringify(views));
    return true;
  } catch {
    return false;
  }
}

export function viewToUrlParams(view: Omit<SavedView, "source">): URLSearchParams {
  const params = new URLSearchParams();
  if (view.search) params.set("q", view.search);
  if (view.sort) params.set("sort", `${view.sort.field}:${view.sort.dir}`);
  if (view.filters) {
    for (const [k, v] of Object.entries(view.filters)) {
      if (v === undefined || v === null) continue;
      params.set(`f_${k}`, String(v));
    }
  }
  return params;
}

export function parseSortParam(raw: string | null): { field: string; dir: "asc" | "desc" } | null {
  if (!raw) return null;
  const [field, dir] = raw.split(":");
  if (!field || (dir !== "asc" && dir !== "desc")) return null;
  return { field, dir };
}
