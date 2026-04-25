/**
 * Convert a Zod error to a FlowPanelConfigError. We pick the first issue,
 * format its path, attach the raw received value, and surface any candidate
 * keys (when the issue is an unknown-key / enum mismatch).
 */

import type { z } from "zod";
import { FlowPanelConfigError } from "../errors";
import { didYouMean } from "./didYouMean";

export function fromZodError(
  err: z.ZodError,
  opts: { received?: unknown; docs?: string } = {},
): FlowPanelConfigError {
  const issue = err.issues[0];
  if (!issue) return new FlowPanelConfigError("invalid config (no zod issue)");

  const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
  const base = `${issue.message} at ${path}`;

  // Narrow the typo from enum mismatches — issue.options carries valid candidates.
  let didYouMeanList: string[] | undefined;
  if (issue.code === "invalid_enum_value") {
    const received = String(issue.received);
    const options = (issue.options as string[] | undefined) ?? [];
    const close = didYouMean(received, options);
    if (close.length > 0) didYouMeanList = close;
  } else if (issue.code === "unrecognized_keys") {
    const keys = (issue as unknown as { keys: string[] }).keys ?? [];
    if (keys.length > 0) {
      didYouMeanList = keys.slice(0, 3);
    }
  }

  return new FlowPanelConfigError(base, {
    ...(opts.received !== undefined ? { received: opts.received } : {}),
    ...(didYouMeanList ? { didYouMean: didYouMeanList } : {}),
    ...(opts.docs ? { docs: opts.docs } : {}),
  });
}
