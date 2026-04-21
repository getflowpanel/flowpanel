import { describe, it, expect } from "vitest";
import {
  FlowPanelError,
  FlowPanelConfigError,
  FlowPanelAdapterError,
  FlowPanelAccessError,
  FlowPanelValidationError,
} from "../errors";

describe("FlowPanel error hierarchy", () => {
  it("FlowPanelConfigError extends FlowPanelError", () => {
    const err = new FlowPanelConfigError("bad config");
    expect(err).toBeInstanceOf(FlowPanelError);
    expect(err).toBeInstanceOf(FlowPanelConfigError);
    expect(err.code).toBe("config");
    expect(err.name).toBe("FlowPanelConfigError");
    expect(err.message).toBe("bad config");
  });

  it("FlowPanelAdapterError extends FlowPanelError", () => {
    const err = new FlowPanelAdapterError("adapter error");
    expect(err).toBeInstanceOf(FlowPanelError);
    expect(err.code).toBe("adapter");
  });

  it("FlowPanelAccessError extends FlowPanelError", () => {
    const err = new FlowPanelAccessError("access denied");
    expect(err).toBeInstanceOf(FlowPanelError);
    expect(err.code).toBe("access");
  });

  it("FlowPanelValidationError extends FlowPanelError", () => {
    const err = new FlowPanelValidationError("invalid value");
    expect(err).toBeInstanceOf(FlowPanelError);
    expect(err.code).toBe("validation");
  });
});
