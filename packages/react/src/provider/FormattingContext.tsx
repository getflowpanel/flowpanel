"use client";
import { DEFAULT_FORMATTING, type ResolvedFormatting } from "@flowpanel/core/format";
import * as React from "react";

const Ctx = React.createContext<ResolvedFormatting>(DEFAULT_FORMATTING);

export function FormattingProvider({
  value,
  children,
}: {
  value?: ResolvedFormatting;
  children: React.ReactNode;
}): React.JSX.Element {
  return <Ctx.Provider value={value ?? DEFAULT_FORMATTING}>{children}</Ctx.Provider>;
}

/** Locale, timezone and currency the admin renders values with. */
export function useFormatting(): ResolvedFormatting {
  return React.useContext(Ctx);
}
