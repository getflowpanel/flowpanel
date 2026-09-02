import { FLOWPANEL_ERROR_STATUS, type FlowpanelErrorCode } from "./result";

export class FlowpanelError extends Error {
  readonly code: FlowpanelErrorCode;
  readonly safeMessage: string;
  readonly status: number;

  constructor(code: FlowpanelErrorCode, safeMessage: string) {
    super(safeMessage);
    this.name = "FlowpanelError";
    this.code = code;
    this.safeMessage = safeMessage;
    this.status = FLOWPANEL_ERROR_STATUS[code];
  }

  toJSON(): { code: string; message: string } {
    return { code: this.code, message: this.safeMessage };
  }
}

export class FlowpanelValidationError extends FlowpanelError {
  readonly fieldErrors: Record<string, string>;
  constructor(fieldErrors: Record<string, string>, message = "Validation failed") {
    super("validation_failed", message);
    this.name = "FlowpanelValidationError";
    this.fieldErrors = fieldErrors;
  }
}

export class FlowpanelAuthError extends FlowpanelError {
  constructor(message = "Authentication required") {
    super("unauthenticated", message);
    this.name = "FlowpanelAuthError";
  }
}

export class FlowpanelAccessError extends FlowpanelError {
  constructor(message = "Forbidden") {
    super("forbidden", message);
    this.name = "FlowpanelAccessError";
  }
}

export class FlowpanelNotFoundError extends FlowpanelError {
  constructor(message = "Not found") {
    super("not_found", message);
    this.name = "FlowpanelNotFoundError";
  }
}

export class FlowpanelConflictError extends FlowpanelError {
  constructor(message = "Conflict") {
    super("conflict", message);
    this.name = "FlowpanelConflictError";
  }
}

export class FlowpanelRateLimitError extends FlowpanelError {
  constructor(message = "Rate limit exceeded") {
    super("rate_limited", message);
    this.name = "FlowpanelRateLimitError";
  }
}

export class FlowpanelUnknownFieldError extends FlowpanelError {
  readonly field: string;

  constructor(field: string) {
    super("unknown_field", `Unknown field: "${field}".`);
    this.name = "FlowpanelUnknownFieldError";
    this.field = field;
  }
}

export class FlowpanelFieldAccessError extends FlowpanelError {
  readonly field: string;

  constructor(field: string) {
    super("field_forbidden", `Field "${field}" cannot be changed.`);
    this.name = "FlowpanelFieldAccessError";
    this.field = field;
  }
}

export class FlowpanelOperationDisabledError extends FlowpanelError {
  constructor(message = "This operation is disabled.") {
    super("operation_disabled", message);
    this.name = "FlowpanelOperationDisabledError";
  }
}
