import type { ResolvedAdminConfig } from "@flowpanel/core";
import { afterEach, describe, expect, it } from "vitest";
import { buildApiHref, buildHref, buildPath, decodeAtom, encodeAtom } from "../runtime/href";

const config = {
  basePath: "/admin",
  paths: { admin: "/admin", api: "/api/flowpanel" },
} as unknown as ResolvedAdminConfig;

const mounted = {
  basePath: "/ops/admin",
  paths: { admin: "/ops/admin", api: "/internal/fp" },
} as unknown as ResolvedAdminConfig;

afterEach(() => {
  delete process.env.__NEXT_ROUTER_BASEPATH;
});

describe("buildHref", () => {
  it("returns the mount for no segments and keeps a nested mount intact", () => {
    expect(buildHref(config)).toBe("/admin");
    expect(buildHref(mounted, "user")).toBe("/ops/admin/user");
  });

  it("escapes a separator inside an identifier instead of routing on it", () => {
    expect(buildHref(config, "order", "a/b")).toBe("/admin/order/a%2Fb");
    expect(buildHref(config, "order", "a%2Fb")).toBe("/admin/order/a%252Fb");
  });

  it("escapes every character that would otherwise change the URL", () => {
    expect(buildHref(config, "order", "a?b")).toBe("/admin/order/a%3Fb");
    expect(buildHref(config, "order", "a#b")).toBe("/admin/order/a%23b");
    expect(buildHref(config, "order", "a b")).toBe("/admin/order/a%20b");
    expect(buildHref(config, "order", "a&b=c")).toBe("/admin/order/a%26b%3Dc");
  });

  it("keeps Unicode and numeric identifiers addressable", () => {
    expect(buildHref(config, "user", "café")).toBe("/admin/user/caf%C3%A9");
    expect(buildHref(config, "user", 42)).toBe("/admin/user/42");
  });

  it("keeps a leading slash inside the identifier it belongs to", () => {
    expect(buildHref(config, "user", "/root")).toBe("/admin/user/%2Froot");
    expect(buildHref(config, "user", "/root")).toBe(
      buildApiHref(config, "user", "/root").replace("/api/flowpanel", "/admin"),
    );
  });

  it("keeps an empty identifier addressable as its own segment", () => {
    expect(buildHref(config, "user", "")).toBe("/admin/user/");
  });

  it("round-trips through one decode, which is what the page route does", () => {
    for (const id of ["a/b", "a%2Fb", "a?b", "café", "100%", "a b", "/root", ""]) {
      const href = buildHref(config, "order", id);
      const [, , , last] = href.split("/") as [string, string, string, string];
      expect(decodeAtom(last)).toBe(id);
    }
  });
});

describe("buildPath", () => {
  it("keeps a configured nested path's separators as separators", () => {
    expect(buildPath(config, "/reports/weekly")).toBe("/admin/reports/weekly");
    expect(buildPath(mounted, "/reports/weekly")).toBe("/ops/admin/reports/weekly");
  });

  it("escapes what is inside a configured segment without escaping the joins", () => {
    expect(buildPath(config, "/reports/last month")).toBe("/admin/reports/last%20month");
  });

  it("returns the mount for the root path", () => {
    expect(buildPath(config, "/")).toBe("/admin");
  });
});

describe("buildApiHref", () => {
  it("builds an app-relative action from encoded atoms", () => {
    expect(buildApiHref(config, "user", "a/b", "edit")).toBe("/api/flowpanel/user/a%2Fb/edit");
    expect(buildApiHref(mounted, "user", "create")).toBe("/internal/fp/user/create");
  });

  it("adds the deployment basePath the browser will not add itself", () => {
    process.env.__NEXT_ROUTER_BASEPATH = "/host";
    expect(buildApiHref(config, "user", "create")).toBe("/host/api/flowpanel/user/create");
  });

  it("prefixes an app-relative path that starts with the same segment", () => {
    // `basePath: "/admin"` with the handlers under `/admin/api` is a real layout;
    // treating it as already-prefixed would send every write to a 404.
    process.env.__NEXT_ROUTER_BASEPATH = "/admin";
    expect(
      buildApiHref(
        {
          basePath: "/admin",
          paths: { admin: "/admin", api: "/admin/api" },
        } as unknown as ResolvedAdminConfig,
        "user",
        "create",
      ),
    ).toBe("/admin/admin/api/user/create");
  });

  it("treats a root or unset basePath as no prefix", () => {
    process.env.__NEXT_ROUTER_BASEPATH = "/";
    expect(buildApiHref(config, "user", "create")).toBe("/api/flowpanel/user/create");
    process.env.__NEXT_ROUTER_BASEPATH = "";
    expect(buildApiHref(config, "user", "create")).toBe("/api/flowpanel/user/create");
    process.env.__NEXT_ROUTER_BASEPATH = "undefined";
    expect(buildApiHref(config, "user", "create")).toBe("/api/flowpanel/user/create");
  });
});

describe("encodeAtom and decodeAtom", () => {
  it("are inverses for the characters identifiers actually carry", () => {
    for (const value of ["a/b", "a b", "a%b", "a#b", "a?b", "café", "undefined", ""]) {
      expect(decodeAtom(encodeAtom(value))).toBe(value);
    }
  });

  it("leaves a malformed escape alone rather than throwing", () => {
    expect(decodeAtom("%")).toBe("%");
    expect(decodeAtom("100%")).toBe("100%");
    expect(decodeAtom("%zz")).toBe("%zz");
  });
});
