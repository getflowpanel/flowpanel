import { describe, expect, it } from "vitest";
import {
  FlowPanelAccessError,
  FlowPanelAdapterError,
  FlowPanelConfigError,
  FlowPanelError,
  FlowPanelValidationError,
} from "../errors";

describe("FlowPanel error hierarchy", () => {
  it("FlowPanelConfigError extends FlowPanelError", () => {
    const err = new FlowPanelConfigError("bad config");
    expect(err).toBeInstanceOf(FlowPanelError);
    expect(err).toBeInstanceOf(FlowPanelConfigError);
    expect(err.code).toBe("config");
    expect(err.name).toBe("FlowPanelConfigError");
    // message is rendered with the canonical prefix; rawMessage preserves the caller's text.
    expect(err.message).toContain("bad config");
    expect(err.rawMessage).toBe("bad config");
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
