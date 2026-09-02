"use client";
import * as React from "react";

export const DEFAULT_API_BASE = "/api/flowpanel";

const Ctx = React.createContext<string>(DEFAULT_API_BASE);

export function ApiBaseProvider({
  value,
  children,
}: {
  value?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return <Ctx.Provider value={value || DEFAULT_API_BASE}>{children}</Ctx.Provider>;
}

/** Where the admin's route handlers are mounted — `paths.api`, defaulted for standalone use. */
export function useApiBase(): string {
  return React.useContext(Ctx);
}
