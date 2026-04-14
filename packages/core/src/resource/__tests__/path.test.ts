import { describe, expect, it } from "vitest";
import {
  createPathProxy,
  getPathSegments,
  getPathString,
  isPath,
  resolvePath,
  resolvePathStrings,
} from "../path";

describe("createPathProxy", () => {
  it("shallow field returns correct path string", () => {
    const proxy = createPathProxy<{ email: string }>();
    const path = proxy.email;
    expect(getPathString(path)).toBe("email");
  });

  it("nested relation returns dot-joined path string", () => {
    const proxy = createPathProxy<{ user: { email: string } }>();
    const path = proxy.user.email;
    expect(getPathString(path)).toBe("user.email");
  });

  it("deep path (depth 4) returns correct path string", () => {
    const proxy = createPathProxy<{
      user: { subscription: { plan: { name: string } } };
    }>();
    const path = proxy.user.subscription.plan.name;
    expect(getPathString(path)).toBe("user.subscription.plan.name");
  });

  it("_count paths work correctly", () => {
    const proxy = createPathProxy<{ _count: { posts: number } }>();
    const path = proxy._count.posts;
    expect(getPathString(path)).toBe("_count.posts");
  });

  it("multiple accesses from same proxy are independent", () => {
    const proxy = createPathProxy<{ email: string; name: string }>();
    const emailPath = proxy.email;
    const namePath = proxy.name;
    expect(getPathString(emailPath)).toBe("email");
    expect(getPathString(namePath)).toBe("name");
  });

  it("sibling accesses after nested access are independent", () => {
    const proxy = createPathProxy<{
      user: { email: string; name: string };
    }>();
    const emailPath = proxy.user.email;
    const namePath = proxy.user.name;
    expect(getPathString(emailPath)).toBe("user.email");
    expect(getPathString(namePath)).toBe("user.name");
  });
});

describe("getPathSegments", () => {
  it("returns array of segments for shallow path", () => {
    const proxy = createPathProxy<{ email: string }>();
    expect(getPathSegments(proxy.email)).toEqual(["email"]);
  });

  it("returns array of segments for nested path", () => {
    const proxy = createPathProxy<{ user: { email: string } }>();
    expect(getPathSegments(proxy.user.email)).toEqual(["user", "email"]);
  });

  it("returns array of segments for deep path", () => {
    const proxy = createPathProxy<{
      user: { subscription: { plan: { name: string } } };
    }>();
    expect(getPathSegments(proxy.user.subscription.plan.name)).toEqual([
      "user",
      "subscription",
      "plan",
      "name",
    ]);
  });
});

describe("isPath", () => {
  it("returns true for a Path object", () => {
    const proxy = createPathProxy<{ email: string }>();
    expect(isPath(proxy.email)).toBe(true);
  });

  it("returns false for a plain object", () => {
    expect(isPath({ email: "test" })).toBe(false);
  });

  it("returns false for primitives", () => {
    expect(isPath("string")).toBe(false);
    expect(isPath(42)).toBe(false);
    expect(isPath(null)).toBe(false);
    expect(isPath(undefined)).toBe(false);
  });
});

describe("resolvePath", () => {
  it("resolves PathFn to a Path with correct string", () => {
    const path = resolvePath<{ user: { email: string } }>(
      (p) => p.user.email,
    );
    expect(getPathString(path)).toBe("user.email");
  });

  it("resolves shallow PathFn", () => {
    const path = resolvePath<{ id: number }>((p) => p.id);
    expect(getPathString(path)).toBe("id");
  });
});

describe("resolvePathStrings", () => {
  it("resolves array of PathFns to string array", () => {
    type Row = { email: string; name: string; createdAt: Date };
    const strings = resolvePathStrings<Row>([
      (p) => p.email,
      (p) => p.name,
      (p) => p.createdAt,
    ]);
    expect(strings).toEqual(["email", "name", "createdAt"]);
  });

  it("resolves nested PathFns to string array", () => {
    type Row = { user: { email: string; name: string } };
    const strings = resolvePathStrings<Row>([
      (p) => p.user.email,
      (p) => p.user.name,
    ]);
    expect(strings).toEqual(["user.email", "user.name"]);
  });

  it("returns empty array for empty input", () => {
    expect(resolvePathStrings([])).toEqual([]);
  });
});
