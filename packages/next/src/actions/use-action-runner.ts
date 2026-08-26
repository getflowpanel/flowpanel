"use client";
import { triggerDownload, useToast } from "@flowpanel/react";
import { useRouter } from "next/navigation";
import * as React from "react";
import type { ActionInputIssue } from "../runtime/action-schema";
import { type ActionFormFieldErrors, mapActionIssuesToFieldErrors } from "./action-form-field";

/** What an action route answers with: `ActionResult`, serialized. */
export type ActionServerResult =
  | {
      ok: true;
      message?: string;
      redirect?: string;
      refresh?: boolean | string | string[];
      download?: { filename: string; data: string; mime?: string };
    }
  | { ok: false; error?: string; issues?: ActionInputIssue[] };

export interface RunActionOptions {
  /** Toast shown on success when the action names no message of its own. */
  successMessage?: string;
  /** Toast shown on failure when the action names no error of its own. */
  failureMessage: string;
  /** Runs after a successful action has refreshed the page. */
  onRefreshed?: () => void;
}

/**
 * The one client-side path for running an action: POST, decode, surface the
 * outcome. Returns field errors for a form dialog to render, or `null` when the
 * outcome was already delivered as a toast, a download or a navigation.
 */
export function useActionRunner(): (
  url: string,
  input: Record<string, unknown>,
  opts: RunActionOptions,
) => Promise<ActionFormFieldErrors | null> {
  const router = useRouter();
  const toast = useToast();

  return React.useCallback(
    async (url, input, opts) => {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
        // A proxy or a crash answers with HTML, not JSON. Fall back to the status
        // line rather than throwing a parse error at the operator.
        const result = (await res
          .json()
          .catch(() => ({ ok: false, error: res.statusText }))) as ActionServerResult;

        if (!res.ok || result.ok === false) {
          const fieldErrors = mapActionIssuesToFieldErrors(
            "issues" in result ? result.issues : undefined,
          );
          if (fieldErrors) return fieldErrors;
          const message = "error" in result ? result.error : undefined;
          toast.error(message || opts.failureMessage);
          return null;
        }

        if (result.message || opts.successMessage) {
          toast.success(result.message ?? opts.successMessage ?? "");
        }
        if (result.download) triggerDownload(result.download);
        if (result.redirect) {
          router.push(result.redirect);
        } else if (result.refresh !== false) {
          router.refresh();
          opts.onRefreshed?.();
        }
        return null;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Network error");
        return null;
      }
    },
    [router, toast],
  );
}
