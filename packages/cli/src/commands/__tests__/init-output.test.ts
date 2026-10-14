import { stripVTControlCharacters as strip } from "node:util";
import pc from "picocolors";
import { describe, expect, it } from "vitest";
import { pmCommands } from "../../utils/detect";
import {
  authNotice,
  conflictMessage,
  missingModuleMessage,
  nextSteps,
  noOrmMessage,
  wrapWords,
} from "../init-output";

describe("nextSteps", () => {
  it("names the command that adds a resource, the dev command, migrate and the guide", () => {
    expect(strip(nextSteps(pmCommands("pnpm")))).toBe(
      [
        "pnpm flowpanel new <table>    add a resource to flowpanel.config.ts",
        "pnpm dev                      start Next.js and open the admin URL below",
        "pnpm flowpanel migrate        only if you turn on the audit log: creates flowpanel_audit_log",
        "https://flowpanel.tech/docs/introduction/getting-started",
      ].join("\n"),
    );
  });

  it("uses the package manager's own runner", () => {
    const npm = strip(nextSteps(pmCommands("npm"))).split("\n");
    expect(npm[0]).toMatch(/^npx flowpanel new <table> {4}add a resource/);
    expect(npm[1]).toMatch(/^npm run dev {18}start Next\.js/);
    expect(strip(nextSteps(pmCommands("yarn")))).toContain("yarn dev ");
  });

  it("writes no escape sequences with colours off, even where picocolors would enable them", () => {
    const plain = nextSteps(pmCommands("pnpm"), pc.createColors(false));
    expect(plain).not.toContain("\u001b[");
    expect(plain).toBe(strip(nextSteps(pmCommands("pnpm"), pc.createColors(true))));
  });

  it("says model for a Prisma host", () => {
    expect(strip(nextSteps(pmCommands("pnpm"), pc, "model"))).toContain(
      "pnpm flowpanel new <model>",
    );
  });

  it("starts every description in one column", () => {
    for (const pm of ["pnpm", "npm", "yarn", "bun"] as const) {
      const [first, second] = strip(nextSteps(pmCommands(pm))).split("\n");
      expect(first?.indexOf("add a resource")).toBe(second?.indexOf("start Next.js"));
    }
  });
});

describe("wrapWords", () => {
  it("breaks between words and keeps every line within the width", () => {
    const wrapped = wrapWords("one two three four five six seven", 10).split("\n");
    expect(wrapped).toEqual(["one two", "three four", "five six", "seven"]);
  });
});

describe("missingModuleMessage", () => {
  it("names each missing module, its flag and a starting file", () => {
    const message = missingModuleMessage(
      [
        { kind: "db", file: "src/server/lib/db.ts", flag: "--db" },
        { kind: "schema", file: "src/server/lib/db/schema.ts", flag: "--schema" },
      ],
      pmCommands("pnpm"),
    );
    expect(message).toContain("your Drizzle client and Drizzle schema");
    expect(message).toContain(
      "  It needs the pg driver: pnpm add pg\n\n  src/server/lib/db/schema.ts",
    );
    expect(message).toContain("--db <module> and --schema <module>");
    expect(message).toContain("  src/server/lib/db.ts\n    import { drizzle }");
    expect(message).toContain("https://flowpanel.tech/docs/introduction/getting-started");
    expect(message).toContain("Then create its table in your database, for example with psql:");
    expect(message).toContain("CREATE TABLE users (id text PRIMARY KEY");
  });

  it("asks for the pg driver only when it is not installed", () => {
    const missing = [{ kind: "db" as const, file: "src/server/lib/db.ts", flag: "--db" }];
    expect(missingModuleMessage(missing, pmCommands("pnpm"), { pg: true })).not.toContain(
      "pg driver",
    );
    expect(missingModuleMessage(missing, pmCommands("pnpm"), { pg: false })).toContain(
      "It needs the pg driver: pnpm add pg",
    );
  });
});

describe("noOrmMessage", () => {
  it("installs ORM versions FlowPanel supports with the project's package manager", () => {
    expect(noOrmMessage(pmCommands("npm"))).toBe(
      "No ORM found in package.json. Add Drizzle with PostgreSQL (npm install drizzle-orm@0 pg and npm install --save-dev @types/pg) or Prisma 6 (npm install @prisma/client@6 and npm install --save-dev prisma@6), then run init again.",
    );
  });
});

describe("authNotice", () => {
  it("says what the closed stub does", () => {
    expect(
      authNotice({ kind: "closed-stub", file: "src/server/lib/auth.ts" }, pmCommands("pnpm")),
    ).toBe(
      "src/server/lib/auth.ts returns no session, so the admin denies every request. Return your provider's session from getSession there, or run pnpm flowpanel init --dev-auth for an open development identity.",
    );
  });

  it("says the development stub is open", () => {
    expect(
      authNotice({ kind: "dev-stub", file: "src/server/lib/auth.ts" }, pmCommands("pnpm")),
    ).toBe(
      "src/server/lib/auth.ts signs every request in as an admin in development and throws under `next start`. Replace it with your auth provider before deploying.",
    );
  });

  it("has nothing to say about a helper the host already wrote", () => {
    expect(authNotice({ kind: "existing" }, pmCommands("pnpm"))).toBeNull();
  });
});

describe("conflictMessage", () => {
  it("lists every path and ends on the rule", () => {
    const lines = conflictMessage(["flowpanel.config.ts", "src/app/admin/layout.tsx"]).split("\n");
    expect(lines.slice(1, 3)).toEqual(["  flowpanel.config.ts", "  src/app/admin/layout.tsx"]);
    expect(lines.at(-1)).toBe("FlowPanel does not overwrite files it did not write.");
  });
});
