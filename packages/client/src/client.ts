import type { FlowpanelResult, ListResult } from "@flowpanel/core";
import {
  type FlowpanelClient,
  type FlowpanelClientMetadata,
  type FlowpanelFetchOptions,
  type FlowpanelListOptions,
  type FlowpanelResourceClient,
  isFlowpanelErrorCode,
} from "./types";

export interface CreateFlowpanelClientOptions {
  fetch?: typeof globalThis.fetch;
}

function safeSegment(value: string): string {
  if (!value || value === "." || value === "..") throw new Error("Invalid Flowpanel path segment.");
  return encodeURIComponent(value);
}

function internal(message = "Unexpected response from Flowpanel."): FlowpanelResult<never> {
  return { ok: false, error: { code: "internal", message } };
}

function isResult(value: unknown): value is FlowpanelResult<unknown> {
  if (!value || typeof value !== "object") return false;
  const object = value as Record<string, unknown>;
  if (object.ok === true) {
    return "data" in object && !!object.meta && typeof object.meta === "object";
  }
  if (object.ok !== false || !object.error || typeof object.error !== "object") return false;
  const error = object.error as Record<string, unknown>;
  return isFlowpanelErrorCode(error.code) && typeof error.message === "string";
}

function query(options: FlowpanelListOptions): string {
  const params = new URLSearchParams();
  if (options.page !== undefined) params.set("page", String(options.page));
  if (options.pageSize !== undefined) params.set("pageSize", String(options.pageSize));
  if (options.search) params.set("search", options.search);
  for (const [field, value] of Object.entries(options.filters ?? {})) {
    if (value !== null && value !== undefined && value !== "") {
      params.set(`filter.${field}`, String(value));
    }
  }
  const value = params.toString();
  return value ? `?${value}` : "";
}

export function createFlowpanelClient(
  metadata: FlowpanelClientMetadata,
  options: CreateFlowpanelClientOptions = {},
): FlowpanelClient {
  if (metadata.protocol.version !== 1) {
    throw new Error(`Unsupported Flowpanel protocol version: ${metadata.protocol.version}`);
  }
  const fetcher = options.fetch ?? globalThis.fetch;

  async function request<T>(
    path: string,
    init: RequestInit,
    requestOptions: FlowpanelFetchOptions,
  ): Promise<FlowpanelResult<T>> {
    let response: Response;
    try {
      const headers = new Headers(requestOptions.headers);
      if (init.body !== undefined) headers.set("content-type", "application/json");
      const fetchInit: RequestInit = {
        ...init,
        credentials: "same-origin",
        headers,
        ...(requestOptions.signal ? { signal: requestOptions.signal } : {}),
      };
      response = await fetcher(`${metadata.paths.api}/${path}`, fetchInit);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      return internal("Unable to reach Flowpanel.") as FlowpanelResult<T>;
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return internal() as FlowpanelResult<T>;
    }
    return isResult(payload) ? (payload as FlowpanelResult<T>) : (internal() as FlowpanelResult<T>);
  }

  return Object.freeze({
    resource<Row extends Record<string, unknown>>(name: string): FlowpanelResourceClient<Row> {
      const resource = safeSegment(name);
      return Object.freeze({
        list(listOptions: FlowpanelListOptions = {}) {
          return request<ListResult<Partial<Row>>>(
            `${resource}${query(listOptions)}`,
            { method: "GET" },
            listOptions,
          );
        },
        get(id: string, requestOptions: FlowpanelFetchOptions = {}) {
          return request<Partial<Row>>(
            `${resource}/${safeSegment(id)}`,
            { method: "GET" },
            requestOptions,
          );
        },
        create(input: Partial<Row>, requestOptions: FlowpanelFetchOptions = {}) {
          return request<Partial<Row>>(
            resource,
            { method: "POST", body: JSON.stringify(input) },
            requestOptions,
          );
        },
        update(id: string, input: Partial<Row>, requestOptions: FlowpanelFetchOptions = {}) {
          return request<Partial<Row>>(
            `${resource}/${safeSegment(id)}`,
            { method: "PATCH", body: JSON.stringify(input) },
            requestOptions,
          );
        },
        delete(id: string, requestOptions: FlowpanelFetchOptions = {}) {
          return request<null>(
            `${resource}/${safeSegment(id)}`,
            { method: "DELETE" },
            requestOptions,
          );
        },
      });
    },
  });
}
