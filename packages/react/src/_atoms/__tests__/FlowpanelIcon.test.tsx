// @vitest-environment happy-dom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FlowpanelIcon } from "../FlowpanelIcon.js";

afterEach(cleanup);

describe("FlowpanelIcon", () => {
  it("renders registered icon names as decorative Lucide icons", () => {
    render(<FlowpanelIcon name="settings" />);
    const icon = document.querySelector('[data-flowpanel-icon="settings"]');
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  });
});
