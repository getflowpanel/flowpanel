import type { ConfigErrorContext } from "./errors/render";
import { renderConfigError } from "./errors/render";

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

/**
 * Config-time failure — thrown synchronously from `defineFlowPanel` and its
 * resolvers. Accepts an optional context (source location, hint, did-you-mean
 * candidates, docs link) that gets folded into the rendered message so the
 * error surface looks the same whether you see it in a stack trace, a log,
 * or the dev server overlay.
 */
export class FlowPanelConfigError extends FlowPanelError {
  readonly context: ConfigErrorContext;
  readonly rawMessage: string;

  constructor(message: string, context: ConfigErrorContext = {}) {
    const rendered = renderConfigError(message, context);
    super("config", rendered);
    this.name = "FlowPanelConfigError";
    this.context = context;
    this.rawMessage = message;
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

export type { ConfigErrorContext };
