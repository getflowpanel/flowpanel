import type { Adapter } from "@flowpanel/core";
import {
  defineAdmin,
  FlowpanelConflictError,
  FlowpanelValidationError,
  RU_LABELS,
  resource,
} from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { explainConstraint } from "../runtime/constraint-error";

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: () => ({
    name: "orders",
    columns: [
      { name: "id", type: "string", nullable: false, unique: true, primaryKey: true },
      { name: "email", type: "string", nullable: false, unique: true, primaryKey: false },
      { name: "userId", type: "number", nullable: false, unique: false, primaryKey: false },
    ],
    primaryKey: "id",
  }),
  inferSchema: () => ({}) as never,
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

function explain(err: unknown, operation: "create" | "update" | "delete" = "create", ru = false) {
  const config = defineAdmin({
    adapter,
    auth: { session: async () => null, role: () => "admin" },
    ...(ru ? { labels: RU_LABELS } : {}),
    resources: [resource({ __name: "orders" }, { columns: ["id", "email", "userId"] })],
  });
  const orders = config.resourcesByName.get("orders");
  if (!orders) throw new Error("fixture: resource not registered");
  return explainConstraint(err, config, orders, operation);
}

const fieldErrorsOf = (err: unknown) =>
  err instanceof FlowpanelValidationError ? err.fieldErrors : undefined;

const wrapped = (cause: object) => new Error("Failed query", { cause });

describe("a write's constraint violation", () => {
  it("names the taken column of a Postgres unique violation, through a wrapped cause", () => {
    const err = explain(wrapped({ code: "23505", detail: "Key (email)=(a@b.c) already exists." }));
    expect(err?.status).toBe(422);
    expect(fieldErrorsOf(err)).toEqual({ email: "Email is already taken" });
  });

  it("matches a snake_case database column to the camelCase field", () => {
    const err = explain({
      code: "23503",
      detail: 'Key (user_id)=(9) is not present in table "users".',
    });
    expect(fieldErrorsOf(err)).toEqual({
      userId: "User ID points to a record that does not exist",
    });
  });

  it("reads a Postgres NOT NULL violation as the required message", () => {
    expect(fieldErrorsOf(explain({ code: "23502", column: "email" }))).toEqual({
      email: "Email is required",
    });
  });

  it("answers 409 when other rows still point at a deleted one", () => {
    const pg = explain(
      { code: "23503", detail: 'Key (id)=(1) is still referenced from table "orders".' },
      "delete",
    );
    expect(pg).toBeInstanceOf(FlowpanelConflictError);
    expect(pg?.safeMessage).toBe("Other records still point to this one");
    expect(
      explain({ code: "SQLITE_CONSTRAINT", message: "FOREIGN KEY constraint failed" }, "delete")
        ?.status,
    ).toBe(409);
  });

  it("answers 409 for a unique violation it cannot tie to one column", () => {
    const err = explain({ code: "23505", detail: "Key (email, userId)=(a, 1) already exists." });
    expect(err).toBeInstanceOf(FlowpanelConflictError);
    expect(err?.safeMessage).toBe("A record with these values already exists");
  });

  it("reads MySQL duplicate, foreign key and null errors", () => {
    expect(
      fieldErrorsOf(
        explain({
          code: "ER_DUP_ENTRY",
          errno: 1062,
          message: "Duplicate entry 'a@b.c' for key 'orders.orders_email_unique'",
        }),
      ),
    ).toEqual({ email: "Email is already taken" });
    expect(
      fieldErrorsOf(
        explain({
          code: "ER_NO_REFERENCED_ROW_2",
          message:
            "Cannot add or update a child row: a foreign key constraint fails (`db`.`orders`, CONSTRAINT `fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`))",
        }),
      ),
    ).toEqual({ userId: "User ID points to a record that does not exist" });
    expect(
      fieldErrorsOf(explain({ errno: 1048, message: "Column 'email' cannot be null" })),
    ).toEqual({
      email: "Email is required",
    });
  });

  it("reads SQLite unique and NOT NULL messages", () => {
    expect(
      fieldErrorsOf(
        explain({
          code: "SQLITE_CONSTRAINT_UNIQUE",
          message: "UNIQUE constraint failed: orders.email",
        }),
      ),
    ).toEqual({ email: "Email is already taken" });
    expect(
      fieldErrorsOf(explain(wrapped({ message: "NOT NULL constraint failed: orders.email" }))),
    ).toEqual({ email: "Email is required" });
  });

  it("reads Prisma P2002, P2003 (Prisma 5 and 6 shapes) and P2011", () => {
    expect(fieldErrorsOf(explain({ code: "P2002", meta: { target: ["email"] } }))).toEqual({
      email: "Email is already taken",
    });
    expect(fieldErrorsOf(explain({ code: "P2002", meta: { target: "orders_email_key" } }))).toEqual(
      {
        email: "Email is already taken",
      },
    );
    expect(
      fieldErrorsOf(explain({ code: "P2003", meta: { field_name: "orders_userId_fkey (index)" } })),
    ).toEqual({ userId: "User ID points to a record that does not exist" });
    expect(
      fieldErrorsOf(
        explain({ code: "P2003", meta: { modelName: "Order", constraint: "orders_user_id_fkey" } }),
      ),
    ).toEqual({ userId: "User ID points to a record that does not exist" });
    expect(fieldErrorsOf(explain({ code: "P2011", meta: { constraint: ["email"] } }))).toEqual({
      email: "Email is required",
    });
  });

  it("speaks the admin's language", () => {
    expect(
      fieldErrorsOf(explain({ code: "P2002", meta: { target: ["email"] } }, "create", true)),
    ).toEqual({
      email: "«Email»: такое значение уже есть",
    });
  });

  it("leaves every other failure alone", () => {
    expect(explain(new Error("connection reset"))).toBeNull();
    expect(explain({ code: "23502" })).toBeNull();
  });
});
