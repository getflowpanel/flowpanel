import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { detectPrismaProvider } from "../prisma-provider";

const roots: string[] = [];

afterEach(async () => {
  for (const dir of roots.splice(0)) await fs.rm(dir, { recursive: true, force: true });
});

async function project(files: Record<string, string>): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fp-prisma-provider-"));
  roots.push(dir);
  for (const [file, source] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(dir, file)), { recursive: true });
    await fs.writeFile(path.join(dir, file), source);
  }
  return dir;
}

const datasource = (provider: string) =>
  `datasource db {\n  provider = "${provider}"\n  url = env("DATABASE_URL")\n}\n`;

describe("detectPrismaProvider", () => {
  it("reads the datasource provider from prisma/schema.prisma, not the generator's", async () => {
    const dir = await project({
      "prisma/schema.prisma": `generator client {\n  provider = "prisma-client-js"\n}\n\n${datasource("mysql")}`,
    });
    expect(await detectPrismaProvider(dir)).toEqual({ status: "found", provider: "mysql" });
  });

  it("maps the postgres alias and reads a multi-file schema folder", async () => {
    const dir = await project({
      "prisma/schema/base.prisma": datasource("postgres"),
      "prisma/schema/user.prisma": "model User {\n  id Int @id\n}\n",
    });
    expect(await detectPrismaProvider(dir)).toEqual({ status: "found", provider: "postgresql" });
  });

  it("ignores a provider line that is commented out above the real one", async () => {
    const dir = await project({
      "prisma/schema.prisma":
        'datasource db {\n  // provider = "sqlite"\n  provider = "postgresql"\n  url = env("DATABASE_URL")\n}\n',
    });
    expect(await detectPrismaProvider(dir)).toEqual({ status: "found", provider: "postgresql" });
  });

  it("ignores a whole datasource block that is commented out", async () => {
    const dir = await project({
      "prisma/schema.prisma": `// datasource old {\n//   provider = "sqlite"\n// }\n${datasource("mysql")}`,
    });
    expect(await detectPrismaProvider(dir)).toEqual({ status: "found", provider: "mysql" });
  });

  it("keeps a // inside a string literal on the same line", async () => {
    const dir = await project({
      "prisma/schema.prisma":
        'datasource db {\n  url = "mysql://u:p@host/db" // local\n  provider = "mysql"\n}\n',
    });
    expect(await detectPrismaProvider(dir)).toEqual({ status: "found", provider: "mysql" });
  });

  it("answers missing when the schema has no datasource or there is no schema", async () => {
    const bare = await project({ "prisma/schema.prisma": "model User {\n  id Int @id\n}\n" });
    const none = await project({});
    expect(await detectPrismaProvider(bare)).toEqual({ status: "missing" });
    expect(await detectPrismaProvider(none)).toEqual({ status: "missing" });
  });

  it("names a provider the adapter does not support", async () => {
    for (const provider of ["mongodb", "sqlserver", "cockroachdb"]) {
      const dir = await project({ "prisma/schema.prisma": datasource(provider) });
      expect(await detectPrismaProvider(dir)).toEqual({ status: "unsupported", provider });
    }
  });

  it("follows package.json#prisma.schema to a file", async () => {
    const dir = await project({
      "package.json": JSON.stringify({ prisma: { schema: "db/schema.prisma" } }),
      "db/schema.prisma": datasource("mysql"),
      "prisma/schema.prisma": datasource("postgresql"),
    });
    expect(await detectPrismaProvider(dir)).toEqual({ status: "found", provider: "mysql" });
  });

  it("follows package.json#prisma.schema to a folder", async () => {
    const dir = await project({
      "package.json": JSON.stringify({ prisma: { schema: "db/models" } }),
      "db/models/main.prisma": datasource("sqlite"),
    });
    expect(await detectPrismaProvider(dir)).toEqual({ status: "found", provider: "sqlite" });
  });

  it("follows a literal schema path in prisma.config.ts", async () => {
    const dir = await project({
      "prisma.config.ts": 'export default { schema: "db/schema.prisma" };\n',
      "db/schema.prisma": datasource("mysql"),
    });
    expect(await detectPrismaProvider(dir)).toEqual({ status: "found", provider: "mysql" });
  });

  it("follows path.join in prisma.config.ts", async () => {
    const dir = await project({
      "prisma.config.ts":
        'import path from "node:path";\nexport default { schema: path.join("db", "schema") };\n',
      "db/schema/a.prisma": datasource("sqlite"),
    });
    expect(await detectPrismaProvider(dir)).toEqual({ status: "found", provider: "sqlite" });
  });

  it("falls back to the default locations when the configured one has no datasource", async () => {
    const dir = await project({
      "package.json": JSON.stringify({ prisma: { schema: "missing.prisma" } }),
      "prisma/schema.prisma": datasource("mysql"),
    });
    expect(await detectPrismaProvider(dir)).toEqual({ status: "found", provider: "mysql" });
  });
});
