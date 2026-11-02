import { renderToString } from "react-dom/server";
import { expect, it } from "vitest";
import { ThemeScript } from "../ThemeScript";

it("passes the host CSP nonce to its inline script", () => {
  const script = ThemeScript({ nonce: "test-nonce", defaultMode: "dark" });
  expect(script.props.nonce).toBe("test-nonce");
  expect(script.props.dangerouslySetInnerHTML.__html).toContain('var m="dark"');
});

it("renders an inert data block when React creates it in the browser", () => {
  expect(ThemeScript({}).props.type).toBe("application/json");
});

it("renders an executable script on the server", async () => {
  const { window } = globalThis as { window?: unknown };
  Reflect.deleteProperty(globalThis, "window");
  try {
    expect(renderToString(<ThemeScript />)).not.toContain("type=");
  } finally {
    Object.assign(globalThis, { window });
  }
});
