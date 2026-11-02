"use client";
import * as React from "react";
import { type ColumnPrefs, columnPrefsCookie, NO_COLUMN_PREFS } from "./column-prefs-cookie";

/** A list's column widths and hidden columns, kept in a cookie per resource so the server renders them. */
export function useColumnPrefs(
  resource: string,
  initial: ColumnPrefs = NO_COLUMN_PREFS,
  path?: string,
) {
  const [prefs, setPrefs] = React.useState(initial);
  const [shownFor, setShownFor] = React.useState(resource);
  if (shownFor !== resource) {
    setShownFor(resource);
    setPrefs(initial);
  }
  const update = (change: Partial<ColumnPrefs>) => {
    const next = { ...prefs, ...change };
    // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is missing from older Safari and Firefox.
    document.cookie = columnPrefsCookie(resource, next, path ?? window.location.pathname);
    setPrefs(next);
  };
  return {
    widths: prefs.widths,
    visibility: prefs.visibility,
    setWidths: (widths: Record<string, number>) => update({ widths }),
    setVisibility: (visibility: Record<string, boolean>) => update({ visibility }),
  };
}
