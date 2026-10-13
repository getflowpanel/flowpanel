"use client";
import { connectionMessage, triggerDownload, useLabels, useToast } from "@flowpanel/react";
import { useRouter } from "next/navigation";
import * as React from "react";
import type { ActionFormFieldErrors } from "./action-form-field";
import { readActionFailure } from "./read-action-failure";

/** What an action route answers with: `ActionResult`, serialized. */
export type ActionServerResult =
  | {
      ok: true;
      message?: string;
      redirect?: string;
      refresh?: boolean | string | string[];
      download?: { filename: string; data: string; mime?: string };
    }
  | { ok: false; error?: unknown; code?: string; fieldErrors?: Record<string, string> };

export interface RunActionOptions {
  /** Toast shown on success when the action names no message of its own. */
  successMessage?: string;
  /** Toast shown on failure when the action names no error of its own. */
  failureMessage: string;
  /** Runs after a successful action has refreshed the page. */
  onRefreshed?: () => void;
  /** `DELETE` sends no body, for the resource's own delete route. */
  method?: "POST" | "DELETE";
  /** Where a success goes, in place of this entry, when the action names no `redirect`: the list after a delete. */
  redirectTo?: string;
}

/**
 * The one client-side path for running an action: POST, decode, surface the outcome.
 * Returns field errors for a form dialog, or `null` when already delivered as a toast, download or navigation.
 */
export function useActionRunner(): (
  url: string,
  input: Record<string, unknown>,
  opts: RunActionOptions,
) => Promise<ActionFormFieldErrors | null> {
  const router = useRouter();
  const { errors } = useLabels();
  const toast = useToast();

  return React.useCallback(
    async (url, input, opts) => {
      try {
        const res = await fetch(
          url,
          opts.method === "DELETE"
            ? { method: "DELETE" }
            : {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(input),
              },
        );
        // A proxy or a crash answers with HTML, not JSON; fall back to the status line instead of a parse error.
        const result = (await res
          .json()
          .catch(() => ({ ok: false, error: res.statusText }))) as ActionServerResult;

        if (!res.ok || result.ok === false) {
          const { message, fieldErrors } = readActionFailure(result);
          if (fieldErrors) return fieldErrors;
          toast.error(message || opts.failureMessage);
          return null;
        }

        if (result.message || opts.successMessage) {
          toast.success(result.message ?? opts.successMessage ?? "");
        }
        if (result.download) triggerDownload(result.download);
        if (result.redirect) {
          router.push(result.redirect);
        } else if (opts.redirectTo) {
          router.replace(opts.redirectTo);
        } else if (result.refresh !== false) {
          router.refresh();
          opts.onRefreshed?.();
        }
        return null;
      } catch {
        toast.error(connectionMessage(errors));
        return null;
      }
    },
    [router, toast, errors],
  );
}
