"use client";
import { formatLabel } from "@flowpanel/core/labels";
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
  useLabels,
  useToast,
} from "@flowpanel/react";
import * as React from "react";
import { useListNavigation } from "./list-navigation";
import {
  LIST_KEYS,
  type ListDefaults,
  loadUserViews,
  parseSortParam,
  persistUserViews,
  type SavedView,
  stateKey,
  urlState,
  viewState,
  viewToUrlParams,
} from "./saved-views-state";

export type { SavedView } from "./saved-views-state";

export interface SavedViewsDropdownProps {
  resource: string;
  staticViews: ReadonlyArray<Omit<SavedView, "source">>;
  /** What the list shows with nothing in the URL, so a view equal to it is recognised. */
  defaults?: ListDefaults;
}

export function SavedViewsDropdown({ resource, staticViews, defaults }: SavedViewsDropdownProps) {
  const { navigate, params: searchParams } = useListNavigation();
  const toast = useToast();
  const labels = useLabels();
  const copy = labels.savedViews;

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

  const activeKey = stateKey(urlState(searchParams), defaults);
  const activeView = allViews.find((v) => stateKey(viewState(v), defaults) === activeKey);
  const unfiltered = activeKey === stateKey({ filters: {}, sort: "", search: "" }, defaults);

  function applyView(view: Omit<SavedView, "source">): void {
    setOpen(false);
    navigate((next) => {
      for (const key of [...next.keys()]) if (LIST_KEYS.test(key)) next.delete(key);
      for (const [key, value] of viewToUrlParams(view)) next.set(key, value);
    }, "push");
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
    // Same name replaces the existing view; duplicates would collide as React keys.
    const next = [...userViews.filter((v) => v.name !== name), view];
    if (!persistUserViews(resource, next)) {
      toast.error(copy.storageError);
      return;
    }
    setUserViews(next);
    setNameOpen(false);
    toast.success(formatLabel(copy.saved, { name }));
  }

  function deleteView(name: string): void {
    const next = userViews.filter((v) => v.name !== name);
    if (!persistUserViews(resource, next)) {
      toast.error(copy.storageError);
      return;
    }
    setUserViews(next);
    toast.success(formatLabel(copy.deleted, { name }));
  }

  const nameDialog = (
    <Dialog open={nameOpen} onOpenChange={setNameOpen}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{copy.save}</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          placeholder={copy.name}
          aria-label={copy.name}
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitSave();
          }}
        />
        <DialogFooter>
          <Button size="sm" variant="outline" onClick={() => setNameOpen(false)}>
            {labels.actions.cancel}
          </Button>
          <Button size="sm" onClick={commitSave} disabled={!draftName.trim()}>
            {labels.actions.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (allViews.length === 0) {
    return (
      <>
        <Button variant="outline" onClick={saveCurrent} className="fp-rounded-full">
          {copy.saveTrigger}
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
          <Button variant="outline" className="fp-rounded-full">
            {activeView
              ? formatLabel(copy.current, { name: activeView.name })
              : unfiltered
                ? formatLabel(copy.current, { name: labels.allOption })
                : copy.label}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="fp-w-56">
          <DropdownMenuLabel>{copy.label}</DropdownMenuLabel>
          {staticViews.length > 0
            ? staticViews.map((v) => (
                <DropdownMenuItem key={`static:${v.name}`} onSelect={() => applyView(v)}>
                  {v.name}
                  {activeView?.name === v.name ? (
                    <span className="fp-ml-auto fp-text-xs">✓</span>
                  ) : null}
                </DropdownMenuItem>
              ))
            : null}
          {userViews.length > 0 ? (
            <>
              {staticViews.length > 0 ? <DropdownMenuSeparator /> : null}
              <DropdownMenuLabel className="fp-text-xs fp-text-faint">
                {copy.yours}
              </DropdownMenuLabel>
              {userViews.map((v) => (
                <DropdownMenuItem
                  key={`user:${v.name}`}
                  onSelect={() => applyView(v)}
                  className="fp-flex fp-items-center fp-justify-between fp-gap-2"
                >
                  <span>{v.name}</span>
                  <button
                    type="button"
                    className="fp-text-xs fp-text-faint hover:fp-text-err"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteView(v.name);
                    }}
                    aria-label={formatLabel(copy.delete, { name: v.name })}
                  >
                    ✕
                  </button>
                </DropdownMenuItem>
              ))}
            </>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={saveCurrent}>{copy.saveCurrent}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
