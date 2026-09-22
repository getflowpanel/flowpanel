import { describe, expect, it } from "vitest";
import { didYouMean, near } from "../suggest";

describe("near", () => {
  it("matches across casing and word separators", () => {
    expect(near("aiUsage", ["ai_usage", "runs"])).toBe("ai_usage");
    expect(near("ai-usage-daily", ["ai_usage_daily"])).toBe("ai_usage_daily");
  });

  it("matches a one- and two-character slip", () => {
    expect(near("emial", ["id", "email"])).toBe("email");
    expect(near("createdA", ["createdAt"])).toBe("createdAt");
    expect(near("statuss", ["status"])).toBe("status");
  });

  it("returns the closest of several near names", () => {
    expect(near("stat", ["status", "state"])).toBe("state");
  });

  it("offers nothing when no name is close", () => {
    expect(near("wildlyDifferent", ["id", "email"])).toBeNull();
    expect(near("id", [])).toBeNull();
  });

  it("does not treat a short name as near every other short name", () => {
    expect(near("qty", ["id"])).toBeNull();
  });
});

describe("didYouMean", () => {
  it("is a clause that reads at the end of a sentence", () => {
    expect(didYouMean("emial", ["email"])).toBe(' Did you mean "email"?');
  });

  it("is empty when nothing is close, so the sentence stands alone", () => {
    expect(didYouMean("zzz", ["email"])).toBe("");
  });
});
