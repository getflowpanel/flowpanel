import { describe, expect, it } from "vitest";
import { browserOrigin } from "../runtime/request-origin";

const req = (headers: Record<string, string>) =>
  new Request("http://localhost:3000/api/x", { method: "POST", headers });

describe("browserOrigin", () => {
  it("prefers the forwarded host and protocol", () => {
    expect(
      browserOrigin(req({ "x-forwarded-host": "demo.example.com", "x-forwarded-proto": "https" })),
    ).toBe("https://demo.example.com");
  });

  it("reads the first hop of a forwarded chain", () => {
    expect(
      browserOrigin(
        req({ "x-forwarded-host": "demo.example.com, inner", "x-forwarded-proto": "https, http" }),
      ),
    ).toBe("https://demo.example.com");
  });

  it("falls back to Host, then to the request URL", () => {
    expect(browserOrigin(req({ host: "admin.example.com" }))).toBe("http://admin.example.com");
    expect(browserOrigin(new Request("https://admin.example.com/x"))).toBe(
      "https://admin.example.com",
    );
  });
});
