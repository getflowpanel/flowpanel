import type {
  FlowpanelErrorCode,
  FlowpanelResult,
  RequestContext,
  ResolvedAdminConfig,
} from "@flowpanel/core";
import { bulkActionRoute } from "../actions/bulk-action";
import { dashboardActionRoute } from "../actions/dashboard-action";
import { restoreRoute } from "../actions/restore";
import { rowActionRoute } from "../actions/row-action";
import { bindRequestContext } from "../runtime/request-setup";
import { toWireValue } from "../wire/serialize";

function codeFor(status: number): FlowpanelErrorCode {
  if (status === 400) return "bad_request";
  if (status === 401) return "unauthenticated";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 413) return "payload_too_large";
  if (status === 415) return "unsupported_media_type";
  if (status === 422) return "validation_failed";
  if (status === 429) return "rate_limited";
  return "internal";
}

async function asResult<T>(
  response: Response,
  context: RequestContext,
): Promise<FlowpanelResult<T>> {
  const id = context.requestId ?? "unknown";
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (response.ok && body && typeof body === "object" && (body as { ok?: unknown }).ok === true) {
    return { ok: true, data: body as T, meta: { requestId: id } };
  }
  const value = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const message =
    typeof value.error === "string"
      ? value.error
      : typeof value.message === "string"
        ? value.message
        : "Request failed";
  return { ok: false, error: { code: codeFor(response.status), message, requestId: id } };
}

function controllerRequest(
  config: ResolvedAdminConfig,
  context: RequestContext,
  path: readonly string[],
  body: Record<string, unknown>,
): Request {
  const url = new URL(
    `${config.paths.api}/${path.map(encodeURIComponent).join("/")}`,
    context.req.url,
  );
  const headers = new Headers(context.req.headers);
  headers.set("content-type", "application/json");
  const request = new Request(url, {
    method: "POST",
    headers,
    body: JSON.stringify(toWireValue(body)),
    signal: context.req.signal,
  });
  bindRequestContext(request, config, context);
  return request;
}

export function createActionController(
  config: ResolvedAdminConfig,
  context: RequestContext,
  resource: string,
) {
  return {
    async row<T = unknown>(id: string, action: string, input: Record<string, unknown> = {}) {
      const request = controllerRequest(config, context, [resource, id, "actions", action], input);
      return asResult<T>(
        await rowActionRoute(config)(request, {
          params: Promise.resolve({ resource, id, action }),
        }),
        context,
      );
    },
    async bulk<T = unknown>(ids: string[], action: string, input: Record<string, unknown> = {}) {
      const request = controllerRequest(config, context, [resource, "bulk-actions", action], {
        ids,
        input,
      });
      return asResult<T>(
        await bulkActionRoute(config)(request, {
          params: Promise.resolve({ resource, action }),
        }),
        context,
      );
    },
    async restore(id: string) {
      const request = controllerRequest(config, context, [resource, id, "restore"], {});
      return asResult<null>(
        await restoreRoute(config)(request, { params: Promise.resolve({ resource, id }) }),
        context,
      );
    },
  };
}

export function createDashboardActionController(
  config: ResolvedAdminConfig,
  context: RequestContext,
  dashboard: string,
) {
  return {
    async action<T = unknown>(action: string, input: Record<string, unknown> = {}) {
      const request = controllerRequest(
        config,
        context,
        ["dashboards", dashboard, "actions", action],
        input,
      );
      return asResult<T>(
        await dashboardActionRoute(config)(request, {
          params: Promise.resolve({ dashboard, action }),
        }),
        context,
      );
    },
  };
}
