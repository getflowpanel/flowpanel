import { defineAdmin, resource } from "@flowpanel/core";
import { getDMMF as getDmmf5 } from "prisma5-internals";
import { getDMMF as getDmmf6 } from "prisma6-internals";
import { describe, expect, it } from "vitest";
import { prismaAdapter } from "../adapter";
import { introspect, type PrismaDmmfField } from "../introspect";
import { checkedDmmf, loadDmmf } from "../runtime";
import { inferSchema } from "../schema";
import prisma619Model from "./fixtures/prisma-6.19-runtime-data-model.json";

const schema = `
datasource db {
  provider = "postgresql"
  url      = "postgresql://localhost:5432/unused"
}

enum Role {
  ADMIN
  USER
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String
  role      Role     @default(USER)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt
  orders    Order[]

  @@map("users")
}

model Order {
  id     String  @id @default(uuid())
  userId Int     @map("user_id")
  user   User    @relation(fields: [userId], references: [id])
  total  Decimal @db.Decimal(10, 2)
  status String  @default("pending")
}

model Tag {
  slug  String @id
  label String
}

model Session {
  id    String @id @default(cuid())
  token String
}

model Device {
  id    String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  label String
}
`;

const readByAdapter = [
  "name",
  "kind",
  "type",
  "isId",
  "isRequired",
  "isUnique",
  "isList",
  "hasDefaultValue",
  "isUpdatedAt",
] as const satisfies readonly (keyof PrismaDmmfField)[];

describe.each([
  ["Prisma 5", getDmmf5],
  ["Prisma 6", getDmmf6],
])("the DMMF %s generates", (_label, getDMMF) => {
  const load = async () => checkedDmmf(await getDMMF({ datamodel: schema }));

  it("carries every field property the adapter reads", async () => {
    const dmmf = await load();
    for (const model of dmmf.datamodel.models) {
      for (const field of model.fields) {
        for (const key of readByAdapter) expect(field).toHaveProperty(key);
      }
    }
  });

  it("marks defaulted, generated and @updatedAt columns as filled by Prisma", async () => {
    const columns = Object.fromEntries(
      introspect("User", await load()).columns.map((column) => [column.name, column]),
    );
    expect(columns.id).toMatchObject({ generated: true, writableOnCreate: false });
    expect(columns.createdAt).toMatchObject({ hasDefault: true, generated: false });
    expect(columns.updatedAt).toMatchObject({ hasDefault: true, writableOnCreate: true });
    expect(columns.role).toMatchObject({ hasDefault: true });
    expect(columns.email).toMatchObject({ hasDefault: false });
  });

  it("creates a user from email and name alone", async () => {
    const { create } = inferSchema("User", await load());
    expect(create.safeParse({ email: "ann@example.com", name: "Ann" }).success).toBe(true);
    expect(create.safeParse({ email: "ann@example.com" }).success).toBe(false);
  });

  it("creates an order without its defaulted status and uuid id", async () => {
    const { create } = inferSchema("Order", await load());
    const parsed = create.safeParse({ userId: 1, total: 12.5 });
    expect(parsed.success).toBe(true);
    expect(parsed.data).not.toHaveProperty("id");
  });

  it("keeps an id the caller must supply", async () => {
    const dmmf = await load();
    const { create } = inferSchema("Tag", dmmf);
    expect(create.safeParse({ slug: "news", label: "News" }).data).toEqual({
      slug: "news",
      label: "News",
    });
    expect(create.safeParse({ label: "News" }).success).toBe(false);
    expect(introspect("Tag", dmmf).columns[0]).toMatchObject({ writableOnCreate: true });
  });
});

describe.each([
  ["Prisma 5", getDmmf5],
  ["Prisma 6", getDmmf6],
])("the create warning for a %s primary key", (_label, getDMMF) => {
  it("names only the key no @default fills", async () => {
    const dmmf = checkedDmmf(await getDMMF({ datamodel: schema }));
    const { warnings } = defineAdmin({
      adapter: prismaAdapter({ prisma: {}, dmmf, provider: "postgresql" }),
      auth: { session: async () => ({ id: "u1" }), role: () => "admin", access: "admin" },
      resources: [
        resource("User", { columns: ["email", "name"] }),
        resource("Order", { columns: ["userId", "total"] }),
        resource("Tag", { columns: ["slug", "label"] }),
        resource("Session", { columns: ["token"] }),
        resource("Device", { columns: ["label"] }),
      ],
    });
    expect(warnings.filter((line) => line.includes("primary key"))).toEqual([
      expect.stringMatching(
        /^resource Tag: create is enabled but primary key `slug` has no default/,
      ),
    ]);
  });
});

describe("the Prisma 6 DMMF", () => {
  it("names the Decimal scale the adapter formats values with", async () => {
    const dmmf = checkedDmmf(await getDmmf6({ datamodel: schema }));
    const total = dmmf.datamodel.models
      .find((model) => model.name === "Order")
      ?.fields.find((field) => field.name === "total");
    expect(total?.nativeType).toEqual(["Decimal", ["10", "2"]]);
  });
});

describe("a client Prisma 6.19 generated", () => {
  // Both the prisma-client-js and the prisma-client generator write this exact data model for the schema above.
  const client = { _runtimeDataModel: prisma619Model };

  it("gives the adapter the same schema getDMMF reads, whichever generator built it", async () => {
    const dmmf = checkedDmmf(await getDmmf6({ datamodel: schema }));
    const adapter = prismaAdapter({ prisma: client, provider: "postgresql" });
    for (const model of ["User", "Order", "Tag", "Session", "Device"]) {
      expect(adapter.introspect(model)).toEqual(introspect(model, dmmf));
    }
    expect(
      adapter.inferSchema("User").create.safeParse({ email: "a@b.co", name: "A" }).data,
    ).toEqual(inferSchema("User", dmmf).create.safeParse({ email: "a@b.co", name: "A" }).data);
  });

  it("names the fix when the client carries no schema", () => {
    for (const notAClient of [{}, { user: {} }, null]) {
      expect(() => loadDmmf(notAClient)).toThrow(
        /found no Prisma schema[\s\S]*new PrismaClient\(\)[\s\S]*"@prisma\/client" with the prisma-client-js generator[\s\S]*`output`[\s\S]*with prisma-client\./,
      );
    }
    expect(() => checkedDmmf(undefined)).toThrow(/found no Prisma schema/);
  });
});
