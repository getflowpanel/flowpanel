import { describe, expect, it } from "vitest";
import { appendToIndex } from "../index-file";

const HOST_INDEX = [
  'import { consents } from "./consents";',
  'import { users } from "./users";',
  "",
  "export const resources = [",
  "  users,",
  "  consents,",
  "] as const;",
  "",
].join("\n");

describe("appendToIndex", () => {
  it("imports the resource and appends it to the exported array", () => {
    expect(appendToIndex(HOST_INDEX, "userVisit", "user-visit")).toBe(
      [
        'import { consents } from "./consents";',
        'import { users } from "./users";',
        'import { userVisit } from "./user-visit";',
        "",
        "export const resources = [",
        "  users,",
        "  consents,",
        "  userVisit,",
        "] as const;",
        "",
      ].join("\n"),
    );
  });

  it("is idempotent", () => {
    const once = appendToIndex(HOST_INDEX, "userVisit", "user-visit");
    expect(appendToIndex(once, "userVisit", "user-visit")).toBe(once);
  });

  it("extends a one-line array on its own line", () => {
    const oneLine = 'import { user } from "./user";\n\nexport const resources = [user] as const;\n';
    expect(appendToIndex(oneLine, "userVisit", "user-visit")).toBe(
      [
        'import { user } from "./user";',
        'import { userVisit } from "./user-visit";',
        "",
        "export const resources = [user, userVisit] as const;",
        "",
      ].join("\n"),
    );
  });

  it("starts an index when there is none", () => {
    expect(appendToIndex(null, "userVisit", "user-visit")).toBe(
      'import { userVisit } from "./user-visit";\n\nexport const resources = [userVisit] as const;\n',
    );
  });

  it("refuses an index with no exported array", () => {
    expect(() =>
      appendToIndex('export { users } from "./users";\n', "userVisit", "user-visit"),
    ).toThrow('exports no array to add "userVisit" to');
  });
});
