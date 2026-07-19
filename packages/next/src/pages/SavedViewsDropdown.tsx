"use client";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  useToast,
} from "@flowpanel/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

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

export interface SavedViewsDropdownProps {
  resource: string;
  staticViews: ReadonlyArray<Omit<SavedView, "source">>;
}

const LS_PREFIX = "flowpanel:views";

function loadUserViews(resource: string): Array<Omit<SavedView, "source">> {
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

function persistUserViews(resource: string, views: ReadonlyArray<Omit<SavedView, "source">>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${LS_PREFIX}:${resource}`, JSON.stringify(views));
  } catch {}
}

function searchParamsToViewKey(params: URLSearchParams): string {
  const entries = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
  return new URLSearchParams(entries).toString();
}

function viewToUrlParams(view: Omit<SavedView, "source">): URLSearchParams {
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

export function SavedViewsDropdown({ resource, staticViews }: SavedViewsDropdownProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();

  const [userViews, setUserViews] = React.useState<Array<Omit<SavedView, "source">>>([]);
  const [open, setOpen] = React.useState(false);
  const [nameOpen, setNameOpen] = React.useState(false);
  const [draftName, setDraftName] = React.useState("");

  React.useEffect(() => {
    setUserViews(loadUserViews(resource));
  }, [resource]);

  const allViews = React.useMemo<SavedView[]>(
    () => [
      ...staticViews.map((v) => ({ ...v, source: "static" as const })),
      ...userViews.map((v) => ({ ...v, source: "user" as const })),
    ],
    [staticViews, userViews],
  );

  const activeKey = React.useMemo(
    () => searchParamsToViewKey(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const activeView = React.useMemo(
    () => allViews.find((v) => searchParamsToViewKey(viewToUrlParams(v)) === activeKey),
    [allViews, activeKey],
  );

  function applyView(view: Omit<SavedView, "source">): void {
    const params = viewToUrlParams(view);
    setOpen(false);
    router.push(`${pathname}?${params.toString()}`);
  }

  function saveCurrent(): void {
    setOpen(false);
    setDraftName("");
    setNameOpen(true);
  }

  function commitSave(): void {
    const name = draftName.trim();
    if (!name) return;
    const view: Omit<SavedView, "source"> = {
      name,
      filters: Object.fromEntries(
        Array.from(searchParams.entries())
          .filter(([k]) => k.startsWith("f_"))
          .map(([k, v]) => [k.slice(2), v]),
      ),
      ...(searchParams.get("q") ? { search: searchParams.get("q") as string } : {}),
      ...(parseSortParam(searchParams.get("sort"))
        ? {
            sort: parseSortParam(searchParams.get("sort")) as {
              field: string;
              dir: "asc" | "desc";
            },
          }
        : {}),
    };
    const next = [...userViews, view];
    setUserViews(next);
    persistUserViews(resource, next);
    setNameOpen(false);
    toast.success(`Saved view "${name}"`);
  }

  function deleteView(name: string): void {
    const next = userViews.filter((v) => v.name !== name);
    setUserViews(next);
    persistUserViews(resource, next);
    toast.success(`Deleted view "${name}"`);
  }

  const nameDialog = (
    <Dialog open={nameOpen} onOpenChange={setNameOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save view</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="Name this view"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitSave();
          }}
        />
        <DialogFooter>
          <Button size="sm" variant="outline" onClick={() => setNameOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={commitSave} disabled={!draftName.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (allViews.length === 0) {
    return (
      <>
        <Button variant="outline" onClick={saveCurrent} className="rounded-full">
          Save view…
        </Button>
        {nameDialog}
      </>
    );
  }

  return (
    <>
      {nameDialog}
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="rounded-full">
            View: {activeView?.name ?? "All"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Views</DropdownMenuLabel>
          {staticViews.length > 0
            ? staticViews.map((v) => (
                <DropdownMenuItem key={`static:${v.name}`} onSelect={() => applyView(v)}>
                  {v.name}
                  {activeView?.name === v.name ? <span className="ml-auto text-xs">✓</span> : null}
                </DropdownMenuItem>
              ))
            : null}
          {userViews.length > 0 ? (
            <>
              {staticViews.length > 0 ? <DropdownMenuSeparator /> : null}
              <DropdownMenuLabel className="text-xs text-fp-text-3">Yours</DropdownMenuLabel>
              {userViews.map((v) => (
                <DropdownMenuItem
                  key={`user:${v.name}`}
                  onSelect={() => applyView(v)}
                  className="flex items-center justify-between gap-2"
                >
                  <span>{v.name}</span>
                  <button
                    type="button"
                    className="text-xs text-fp-text-3 hover:text-fp-err"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteView(v.name);
                    }}
                    aria-label={`Delete view ${v.name}`}
                  >
                    ✕
                  </button>
                </DropdownMenuItem>
              ))}
            </>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={saveCurrent}>Save current view…</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

function parseSortParam(raw: string | null): { field: string; dir: "asc" | "desc" } | null {
  if (!raw) return null;
  const [field, dir] = raw.split(":");
  if (!field || (dir !== "asc" && dir !== "desc")) return null;
  return { field, dir };
}
