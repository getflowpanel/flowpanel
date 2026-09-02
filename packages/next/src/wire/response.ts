import type { FlowpanelResult } from "@flowpanel/core";
import { resultResponse } from "@flowpanel/core";
import { toWireValue } from "./serialize";

export function wireResponse<T>(result: FlowpanelResult<T>, init?: ResponseInit): Response {
  if (init) {
    return Response.json(toWireValue(result), init);
  }
  return resultResponse(toWireValue(result) as unknown as FlowpanelResult<T>);
}

export function methodNotAllowed(allowed: readonly string[]): Response {
  return Response.json(
    {
      ok: false,
      error: { code: "method_not_allowed", message: "Method not allowed" },
    },
    { status: 405, headers: { Allow: allowed.join(", ") } },
  );
}
