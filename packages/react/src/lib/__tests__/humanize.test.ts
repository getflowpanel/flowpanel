import { describe, expect, it } from "vitest";
import { humanize, resolveFieldLabel } from "../humanize.js";

describe("humanize", () => {
  it("capitalizes single words as sentence case", () => {
    expect(humanize("email")).toBe("Email");
    expect(humanize("name")).toBe("Name");
  });

  it("splits camelCase into sentence case", () => {
    expect(humanize("firstName")).toBe("First name");
    expect(humanize("createdAt")).toBe("Created at");
  });

  it("preserves common initialisms uppercase", () => {
    expect(humanize("telegramId")).toBe("Telegram ID");
    expect(humanize("apiKey")).toBe("API key");
    expect(humanize("avatarUrl")).toBe("Avatar URL");
    expect(humanize("userUuid")).toBe("User UUID");
  });

  it("splits snake_case and kebab-case", () => {
    expect(humanize("created_at")).toBe("Created at");
    expect(humanize("user-name")).toBe("User name");
  });

  it("handles PascalCase", () => {
    expect(humanize("FirstName")).toBe("First name");
  });

  it("handles upper-run boundaries", () => {
    expect(humanize("URLPath")).toBe("URL path");
    expect(humanize("HTTPStatus")).toBe("HTTP status");
  });

  it("returns empty string for empty input", () => {
    expect(humanize("")).toBe("");
  });
});

describe("resolveFieldLabel", () => {
  it("returns explicit label when provided", () => {
    expect(resolveFieldLabel("Custom", "email")).toBe("Custom");
  });

  it("respects empty-string override", () => {
    expect(resolveFieldLabel("", "email")).toBe("");
  });

  it("humanizes raw field when label is undefined", () => {
    expect(resolveFieldLabel(undefined, "telegramId")).toBe("Telegram ID");
  });
});
