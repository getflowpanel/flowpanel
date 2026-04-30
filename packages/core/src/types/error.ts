export class FlowpanelError extends Error {
  readonly code: string;
  readonly safeMessage: string;
  readonly status: number;

  constructor(code: string, safeMessage: string, status = 500) {
    super(safeMessage);
    this.name = "FlowpanelError";
    this.code = code;
    this.safeMessage = safeMessage;
    this.status = status;
  }

  toJSON(): { code: string; message: string } {
    return { code: this.code, message: this.safeMessage };
  }
}

export class FlowpanelValidationError extends FlowpanelError {
  readonly fieldErrors: Record<string, string>;
  constructor(fieldErrors: Record<string, string>, message = "Validation failed") {
    super("validation", message, 400);
    this.name = "FlowpanelValidationError";
    this.fieldErrors = fieldErrors;
  }
}

export class FlowpanelAuthError extends FlowpanelError {
  constructor(message = "Authentication required") {
    super("auth", message, 401);
    this.name = "FlowpanelAuthError";
  }
}

export class FlowpanelAccessError extends FlowpanelError {
  constructor(message = "Forbidden") {
    super("access", message, 403);
    this.name = "FlowpanelAccessError";
  }
}

export class FlowpanelNotFoundError extends FlowpanelError {
  constructor(message = "Not found") {
    super("not_found", message, 404);
    this.name = "FlowpanelNotFoundError";
  }
}

export class FlowpanelConflictError extends FlowpanelError {
  constructor(message = "Conflict") {
    super("conflict", message, 409);
    this.name = "FlowpanelConflictError";
  }
}

export class FlowpanelRateLimitError extends FlowpanelError {
  constructor(message = "Rate limit exceeded") {
    super("rate_limit", message, 429);
    this.name = "FlowpanelRateLimitError";
  }
}
