import type { FlowpanelErrorCode, FlowpanelResult, ListResult } from "@flowpanel/core";

export interface FlowpanelClientMetadata {
  readonly id: string;
  readonly paths: { readonly admin: string; readonly api: string };
  readonly protocol: { readonly version: 1; readonly methods: readonly string[] };
}

export interface FlowpanelFetchOptions {
  signal?: AbortSignal;
  headers?: HeadersInit;
}

export interface FlowpanelListOptions extends FlowpanelFetchOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  filters?: Record<string, string | number | boolean | null | undefined>;
}

export interface FlowpanelResourceClient<Row extends Record<string, unknown>> {
  list(options?: FlowpanelListOptions): Promise<FlowpanelResult<ListResult<Partial<Row>>>>;
  get(id: string, options?: FlowpanelFetchOptions): Promise<FlowpanelResult<Partial<Row>>>;
  create(
    input: Partial<Row>,
    options?: FlowpanelFetchOptions,
  ): Promise<FlowpanelResult<Partial<Row>>>;
  update(
    id: string,
    input: Partial<Row>,
    options?: FlowpanelFetchOptions,
  ): Promise<FlowpanelResult<Partial<Row>>>;
  delete(id: string, options?: FlowpanelFetchOptions): Promise<FlowpanelResult<null>>;
}

export interface FlowpanelClient {
  resource<Row extends Record<string, unknown> = Record<string, unknown>>(
    name: string,
  ): FlowpanelResourceClient<Row>;
}

export function isFlowpanelErrorResult(
  value: FlowpanelResult<unknown>,
): value is Extract<FlowpanelResult<unknown>, { ok: false }> {
  return !value.ok;
}

// Listed literally: a runtime import of core's status map would drag the whole
// core barrel (AsyncLocalStorage included) into the browser bundle. The type
// checks below fail compilation if this list drifts from core's codes.
const ERROR_CODES = [
  "bad_request",
  "unknown_field",
  "unauthenticated",
  "forbidden",
  "field_forbidden",
  "operation_disabled",
  "not_found",
  "method_not_allowed",
  "conflict",
  "payload_too_large",
  "unsupported_media_type",
  "validation_failed",
  "rate_limited",
  "internal",
] as const satisfies readonly FlowpanelErrorCode[];
type MissingErrorCode = Exclude<FlowpanelErrorCode, (typeof ERROR_CODES)[number]>;
const _allErrorCodesListed: MissingErrorCode extends never ? true : never = true;
void _allErrorCodesListed;

const ERROR_CODE_SET: ReadonlySet<string> = new Set(ERROR_CODES);

export function isFlowpanelErrorCode(value: unknown): value is FlowpanelErrorCode {
  return typeof value === "string" && ERROR_CODE_SET.has(value);
}
