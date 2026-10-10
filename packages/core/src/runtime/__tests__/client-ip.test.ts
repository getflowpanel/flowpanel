import { describe, expect, it } from "vitest";
import { clientIpFrom } from "../client-ip";

const forwarded = (value: string) => new Headers({ "x-forwarded-for": value });

describe("clientIpFrom", () => {
  it("trusts no header by default", () => {
    expect(clientIpFrom(forwarded("1.1.1.1"), 0)).toBeNull();
  });

  it("takes the entry the outermost trusted proxy appended, not the client's own", () => {
    expect(clientIpFrom(forwarded("6.6.6.6, 203.0.113.7"), 1)).toBe("203.0.113.7");
    expect(clientIpFrom(forwarded("6.6.6.6, 203.0.113.7, 10.0.0.2"), 2)).toBe("203.0.113.7");
  });

  it("drops a port the proxy wrote after the address", () => {
    expect(clientIpFrom(forwarded("203.0.113.7:51234"), 1)).toBe("203.0.113.7");
    expect(clientIpFrom(forwarded("[2001:db8::1]:443"), 1)).toBe("2001:db8::1");
    expect(clientIpFrom(forwarded("2001:db8::1"), 1)).toBe("2001:db8::1");
  });

  it("answers null when fewer proxies than configured wrote the header", () => {
    expect(clientIpFrom(forwarded("203.0.113.7"), 2)).toBeNull();
    expect(clientIpFrom(new Headers(), 1)).toBeNull();
  });
});
