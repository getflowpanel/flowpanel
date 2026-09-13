"use client";
import { useRouter } from "next/navigation";
import * as React from "react";

/**
 * Navigate to a row's own href. Widgets hand rows to `DataTable` as data, so the
 * one thing a row click needs is a push; this keeps that push in one place for
 * every widget and table that gains row navigation.
 */
export function useRowNavigation(): (href: string) => void {
  const router = useRouter();
  return React.useCallback(
    (href: string) => {
      router.push(href);
    },
    [router],
  );
}
