export const FLOWPANEL_ERROR_STATUS = {
  bad_request: 400,
  unknown_field: 400,
  unauthenticated: 401,
  forbidden: 403,
  field_forbidden: 403,
  operation_disabled: 403,
  not_found: 404,
  method_not_allowed: 405,
  conflict: 409,
  payload_too_large: 413,
  unsupported_media_type: 415,
  validation_failed: 422,
  rate_limited: 429,
  internal: 500,
} as const;

export type FlowpanelErrorCode = keyof typeof FLOWPANEL_ERROR_STATUS;

export type FlowpanelWarningCode = "audit_failed" | "realtime_failed" | "revalidation_failed";

export interface FlowpanelWarning {
  code: FlowpanelWarningCode;
  message: string;
}

export interface FlowpanelResultMeta {
  requestId: string;
  warnings?: FlowpanelWarning[];
}

export interface FlowpanelResultError {
  code: FlowpanelErrorCode;
  message: string;
  fieldErrors?: Record<string, string>;
  requestId?: string;
}

export type FlowpanelResult<T> =
  | { ok: true; data: T; meta: FlowpanelResultMeta }
  | { ok: false; error: FlowpanelResultError };
