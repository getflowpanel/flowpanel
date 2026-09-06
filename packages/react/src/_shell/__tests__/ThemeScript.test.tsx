import { expect, it } from "vitest";
import { ThemeScript } from "../ThemeScript";

it("passes the host CSP nonce to its inline script", () => {
  const script = ThemeScript({ nonce: "test-nonce", defaultMode: "dark" });
  expect(script.props.nonce).toBe("test-nonce");
  expect(script.props.dangerouslySetInnerHTML.__html).toContain('var m="dark"');
});
