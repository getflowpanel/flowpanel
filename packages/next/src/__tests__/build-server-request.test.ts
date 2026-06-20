import { describe, expect, it, vi } from "vitest";

const fakeHeaders = new Headers({
  "x-forwarded-for": "1.2.3.4",
  "user-agent": "test-agent",
});
const fakeCookies: Array<{ name: string; value: string }> = [{ name: "session", value: "abc123" }];

vi.mock("next/headers", () => ({
  headers: async () => fakeHeaders,
  cookies: async () => ({ getAll: () => fakeCookies }),
}));

import { buildServerRequest } from "../runtime/build-server-request.js";

describe("buildServerRequest", () => {
  it("carries real headers (x-forwarded-for, user-agent) onto the Request", async () => {
    const req = await buildServerRequest("http://localhost/admin/users");
    expect(req.headers.get("x-forwarded-for")).toBe("1.2.3.4");
    expect(req.headers.get("user-agent")).toBe("test-agent");
  });

  it("synthesizes a Cookie header from cookies().getAll()", async () => {
    const req = await buildServerRequest("http://localhost/admin/users");
    expect(req.headers.get("cookie")).toBe("session=abc123");
  });

  it("joins multiple cookies with '; '", async () => {
    fakeCookies.push({ name: "theme", value: "dark" });
    try {
      const req = await buildServerRequest("http://localhost/admin/users");
      expect(req.headers.get("cookie")).toBe("session=abc123; theme=dark");
    } finally {
      fakeCookies.pop();
    }
  });

  it("accepts a URL instance and preserves the query string", async () => {
    const req = await buildServerRequest(new URL("http://localhost/admin/orders?x=1"));
    expect(req.url).toBe("http://localhost/admin/orders?x=1");
  });
});
