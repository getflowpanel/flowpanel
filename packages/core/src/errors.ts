export class FlowPanelError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "FlowPanelError";
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class FlowPanelConfigError extends FlowPanelError {
  constructor(message: string) {
    super("config", message);
    this.name = "FlowPanelConfigError";
  }
}

export class FlowPanelAdapterError extends FlowPanelError {
  constructor(message: string) {
    super("adapter", message);
    this.name = "FlowPanelAdapterError";
  }
}

export class FlowPanelAccessError extends FlowPanelError {
  constructor(message: string) {
    super("access", message);
    this.name = "FlowPanelAccessError";
  }
}

export class FlowPanelValidationError extends FlowPanelError {
  constructor(message: string) {
    super("validation", message);
    this.name = "FlowPanelValidationError";
  }
}
