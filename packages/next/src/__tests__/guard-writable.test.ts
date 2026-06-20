import type { ResolvedAdminConfig } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { guardWritable } from "../runtime/action-helpers.js";

describe("guardWritable", () => {
  it("returns a 403 Response when the admin is read-only", async () => {
    const res = guardWritable({ readOnly: true } as ResolvedAdminConfig);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(403);
    expect(await res?.json()).toEqual({ ok: false, error: "This admin is read-only." });
  });

  it("returns null when writes are allowed", () => {
    expect(guardWritable({ readOnly: false } as ResolvedAdminConfig)).toBeNull();
    expect(guardWritable({} as ResolvedAdminConfig)).toBeNull();
  });
});
