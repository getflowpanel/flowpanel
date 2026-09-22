"use client";
import * as React from "react";
import { withDeploymentBasePath } from "../lib/deployment-base";

export const DEFAULT_API_BASE = "/api/flowpanel";

const Ctx = React.createContext<string>(DEFAULT_API_BASE);

export function ApiBaseProvider({
  value,
  children,
}: {
  value?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  // The fallback is app-relative like `paths.api`, so it needs the same prefix:
  // a shell that never passes `value` would otherwise fetch outside the deployment.
  return (
    <Ctx.Provider value={value || withDeploymentBasePath(DEFAULT_API_BASE)}>
      {children}
    </Ctx.Provider>
  );
}

/** Where the admin's route handlers are mounted — `paths.api`, defaulted for standalone use. */
export function useApiBase(): string {
  return React.useContext(Ctx);
}
