import { stripVTControlCharacters as strip } from "node:util";
import pc from "picocolors";
import { describe, expect, it } from "vitest";
import { pmCommands } from "../../utils/detect";
import { authNotice, conflictMessage, nextSteps } from "../init-output";

describe("nextSteps", () => {
  it("names the command that adds a resource, the dev command and the URL", () => {
    expect(strip(nextSteps(pmCommands("pnpm"), "/admin"))).toBe(
      [
        "Next",
        "  pnpm flowpanel new <table>    add a resource to flowpanel.config.ts",
        "  pnpm dev                      start Next.js, then open http://localhost:3000/admin",
        "  https://flowpanel.tech/docs/introduction/getting-started",
      ].join("\n"),
    );
  });

  it("uses the package manager's own runner and the configured mount", () => {
    const npm = strip(nextSteps(pmCommands("npm"), "/ops/admin")).split("\n");
    expect(npm[1]).toMatch(/^ {2}npx flowpanel new <table> {4}add a resource/);
    expect(npm[2]).toMatch(
      /^ {2}npm run dev {18}start Next\.js, then open http:\/\/localhost:3000\/ops\/admin$/,
    );
    expect(strip(nextSteps(pmCommands("yarn"), "/admin"))).toContain("  yarn dev ");
  });

  it("writes no escape sequences with colours off, even where picocolors would enable them", () => {
    const plain = nextSteps(pmCommands("pnpm"), "/admin", pc.createColors(false));
    expect(plain).not.toContain("\u001b[");
    expect(plain).toBe(strip(nextSteps(pmCommands("pnpm"), "/admin", pc.createColors(true))));
  });

  it("says model for a Prisma host", () => {
    expect(strip(nextSteps(pmCommands("pnpm"), "/admin", pc, "model"))).toContain(
      "pnpm flowpanel new <model>",
    );
  });

  it("starts every description in one column", () => {
    for (const pm of ["pnpm", "npm", "yarn", "bun"] as const) {
      const [, first, second] = strip(nextSteps(pmCommands(pm), "/admin")).split("\n");
      expect(first?.indexOf("add a resource")).toBe(second?.indexOf("start Next.js"));
    }
  });
});

describe("authNotice", () => {
  it("says what the closed stub does", () => {
    expect(authNotice({ kind: "closed-stub", file: "src/server/lib/auth.ts" })).toBe(
      "Authentication: src/server/lib/auth.ts returns no session, so the admin denies every request until you connect your provider.",
    );
  });

  it("says the development stub is open", () => {
    expect(authNotice({ kind: "dev-stub", file: "src/server/lib/auth.ts" })).toBe(
      "Authentication: src/server/lib/auth.ts is an open development identity. Replace it before deploying.",
    );
  });

  it("has nothing to say about a helper the host already wrote", () => {
    expect(authNotice({ kind: "existing" })).toBeNull();
  });
});

describe("conflictMessage", () => {
  it("lists every path and ends on the rule", () => {
    const lines = conflictMessage(["flowpanel.config.ts", "src/app/admin/layout.tsx"]).split("\n");
    expect(lines.slice(1, 3)).toEqual(["  flowpanel.config.ts", "  src/app/admin/layout.tsx"]);
    expect(lines.at(-1)).toBe("FlowPanel does not overwrite files it did not write.");
  });
});
