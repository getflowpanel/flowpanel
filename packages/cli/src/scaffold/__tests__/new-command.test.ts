import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runCommand } from "../../commands/__tests__/command-harness";
import { newCommand } from "../../commands/new";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const fixture = (file: string) => readFileSync(join(FIXTURES, "project", file), "utf8");

const BASE = {
  "package.json": JSON.stringify({ dependencies: { next: "16.3.4", "drizzle-orm": "0.45.2" } }),
  "tsconfig.json": JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./*"] } } }),
  "db/schema.ts": fixture("db/schema.ts"),
};

const DRIZZLE_CONFIG = `import { defineAdmin } from "@flowpanel/kit";
import * as schema from "@/db/schema";

export default defineAdmin({
  resources: [
    // pnpm flowpanel new <table>  adds an entry; or write resource(schema.users, { columns: ["email", "name", "createdAt"] })
  ],
});
`;

async function run(args: string[], files: Record<string, string>, read: string[] = []) {
  let contents: Record<string, string> = {};
  const result = await runCommand(
    (cli) => {
      newCommand(cli);
      cli.hook("postAction", () => {
        contents = Object.fromEntries(
          read.map((file) => [file, readFileSync(join(process.cwd(), file), "utf8")]),
        );
      });
    },
    ["new", ...args],
    files,
    FIXTURES,
  );
  return { ...result, contents };
}

describe("flowpanel new on a Drizzle config", () => {
  it("writes the introspected columns, search and sort, not empty options", async () => {
    const result = await run(["user"], { ...BASE, "flowpanel.config.ts": DRIZZLE_CONFIG }, [
      "flowpanel.config.ts",
    ]);
    expect(result.exit).toBeNull();
    const config = result.contents["flowpanel.config.ts"] ?? "";
    expect(config).toContain('import { defineAdmin, resource } from "@flowpanel/kit";');
    expect(config).toContain("    resource(schema.user, {\n      columns: [\n");
    expect(config).toContain('      search: ["email", "name"],');
    expect(config).toContain('      defaultSort: { field: "createdAt", dir: "desc" },');
    expect(config).toContain("    }),\n  ],");
    expect(config).not.toContain("adds an entry");
  });

  it("writes hidden: true inline when --hidden is given without --dir", async () => {
    const result = await run(
      ["user", "--hidden"],
      { ...BASE, "flowpanel.config.ts": DRIZZLE_CONFIG },
      ["flowpanel.config.ts"],
    );
    expect(result.contents["flowpanel.config.ts"]).toContain("      hidden: true,\n");
  });

  it("wires a new --dir directory into the config the first time", async () => {
    const result = await run(
      ["user", "--dir", "admin/resources"],
      { ...BASE, "flowpanel.config.ts": DRIZZLE_CONFIG },
      ["flowpanel.config.ts", "admin/resources/index.ts"],
    );
    expect(result.exit).toBeNull();
    const config = result.contents["flowpanel.config.ts"] ?? "";
    expect(config).toContain('import { resources } from "@/admin/resources";');
    expect(config).toContain("resources: [...resources],");
    expect(result.contents["admin/resources/index.ts"]).toContain('import { user } from "./user";');
  });

  it("writes into the directory a split config already reads, without --dir", async () => {
    const result = await run(
      ["user_visit"],
      {
        ...BASE,
        "tsconfig.json": fixture("tsconfig.json"),
        "flowpanel.config.ts": fixture("flowpanel.config.ts"),
        "admin/config/index.ts": fixture("admin/config/index.ts"),
        "admin/config/resources/index.ts": fixture("admin/config/resources/index.ts"),
        "admin/config/resources/user.ts": fixture("admin/config/resources/user.ts"),
      },
      ["admin/config/resources/index.ts", "admin/config/index.ts"],
    );
    expect(result.exit).toBeNull();
    expect(result.contents["admin/config/resources/index.ts"]).toContain(
      'import { userVisit } from "./user-visit";',
    );
    expect(result.contents["admin/config/index.ts"]).toBe(fixture("admin/config/index.ts"));
    expect(result.stdout).toContain('Added resource "user_visit" to admin/config/resources');
  });
});

const PRISMA_CONFIG = `import { defineAdmin } from "@flowpanel/kit";
import { prismaAdapter } from "@flowpanel/kit/prisma";
import { prisma } from "@/lib/prisma";

declare module "@flowpanel/kit" {
  interface FlowpanelTypes {
    db: typeof prisma;
  }
}

export default defineAdmin({
  adapter: prismaAdapter({ prisma, provider: "postgresql" }),
  resources: [
    // pnpm flowpanel new <model>  adds an entry; or write resource("User", { columns: ["email", "name", "createdAt"] })
  ],
});
`;

const PRISMA_SCHEMA = `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  MEMBER
}

model User {
  id        String   @id
  email     String   @unique
  name      String?
  role      Role     @default(MEMBER)
  bio       String?  @db.Text
  settings  Json?
  createdAt DateTime @default(now())
  posts     Post[]

  @@map("users")
}

model Post {
  id       Int    @id @default(autoincrement())
  title    String
  author   User   @relation(fields: [authorId], references: [id])
  authorId String
}
`;

describe("flowpanel new on a Prisma config", () => {
  const files = {
    ...BASE,
    "flowpanel.config.ts": PRISMA_CONFIG,
    "prisma/schema.prisma": PRISMA_SCHEMA,
  };

  it("resolves the table name to its model, writes its columns and types it", async () => {
    const result = await run(["users"], files, ["flowpanel.config.ts"]);
    expect(result.exit).toBeNull();
    const config = result.contents["flowpanel.config.ts"] ?? "";
    expect(config).toContain('    resource("User", {\n      name: "users",\n      columns: [\n');
    expect(config).toContain(
      '        { field: "createdAt", format: { kind: "date", time: true } },',
    );
    expect(config).toContain('      filters: [{ field: "role", type: "select" }],');
    expect(config).not.toContain('"settings"');
    expect(config).not.toContain('"posts"');
    expect(config).toContain(
      '  interface FlowpanelResources {\n    users: import("@prisma/client").User;\n  }\n}',
    );
    expect(result.stdout).toContain('Using the User model for "users".');
  });

  it("names an unmapped model like a table and points its foreign key at the registered resource", async () => {
    const first = await run(["users"], files, ["flowpanel.config.ts"]);
    const withUsers = first.contents["flowpanel.config.ts"] ?? "";
    const result = await run(["Post"], { ...files, "flowpanel.config.ts": withUsers }, [
      "flowpanel.config.ts",
    ]);
    expect(result.exit).toBeNull();
    const config = result.contents["flowpanel.config.ts"] ?? "";
    expect(config).toContain('    resource("Post", {\n      name: "posts",\n');
    expect(config).toContain(
      '        { field: "authorId", label: "Author", reference: { resource: "users", labelField: "email" } },',
    );
    expect(config).toContain(
      '    users: import("@prisma/client").User;\n    posts: import("@prisma/client").Post;\n',
    );
    expect(result.stdout).toContain('Added resource "posts"');
  });

  it("writes a foreign key to a model the admin does not list yet as a plain column", async () => {
    const result = await run(["Post"], files, ["flowpanel.config.ts"]);
    const config = result.contents["flowpanel.config.ts"] ?? "";
    expect(config).toContain('        "authorId",\n');
    expect(config).not.toContain("reference:");
  });

  it("refuses a name that is no model, listing the models", async () => {
    const result = await run(["widgets"], files);
    expect(result.exit).toBe(1);
    expect(result.stderr).toContain('schema.prisma has no model named "widgets".');
    expect(result.stderr).toContain("Models: User, Post");
  });
});
