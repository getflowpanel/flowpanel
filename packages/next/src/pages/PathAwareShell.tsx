"use client";
import { AdminShell, type AdminShellProps } from "@flowpanel/react";
import { usePathname } from "next/navigation";

/** The admin shell where only the browser knows the path, as on the not-found page. */
export function PathAwareShell(props: Omit<AdminShellProps, "currentPath">) {
  return <AdminShell {...props} currentPath={usePathname()} />;
}
