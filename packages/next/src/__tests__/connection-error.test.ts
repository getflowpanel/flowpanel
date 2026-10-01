import { describe, expect, it } from "vitest";
import { isConnectionError } from "../runtime/connection-error";

const coded = (code: string, message = "failed") => Object.assign(new Error(message), { code });

describe("isConnectionError", () => {
  it.each([
    "ECONNREFUSED",
    "ENOTFOUND",
    "ETIMEDOUT",
    "ECONNRESET",
    "EAI_AGAIN",
    "EHOSTUNREACH",
    "28P01",
    "28000",
    "3D000",
    "08001",
    "08006",
  ])("reads the %s code as a connection failure", (code) => {
    expect(isConnectionError(coded(code))).toBe(true);
  });

  it.each([
    'password authentication failed for user "app"',
    'database "shop" does not exist',
    "connect ECONNREFUSED 127.0.0.1:5432",
    "Can't reach database server at `db:5432`",
  ])("reads %j as a connection failure", (message) => {
    expect(isConnectionError(new Error(message))).toBe(true);
  });

  it("finds the failure down the cause chain and inside an AggregateError", () => {
    const wrapped = new Error("Failed query: select 1", { cause: coded("ECONNREFUSED") });
    expect(isConnectionError(new Error("outer", { cause: wrapped }))).toBe(true);
    const aggregate = new AggregateError([coded("ECONNREFUSED"), coded("ECONNREFUSED")], "");
    expect(isConnectionError(aggregate)).toBe(true);
  });

  it("reads a Prisma initialization error by its error code", () => {
    expect(isConnectionError(Object.assign(new Error("init"), { errorCode: "P1001" }))).toBe(true);
  });

  it("leaves schema and query errors to the query hint", () => {
    expect(isConnectionError(coded("42P01", 'relation "users" does not exist'))).toBe(false);
    expect(isConnectionError(coded("42703", 'column "emial" does not exist'))).toBe(false);
    expect(isConnectionError(new Error("connection refused"))).toBe(false);
    expect(isConnectionError(null)).toBe(false);
    expect(isConnectionError("ECONNREFUSED")).toBe(false);
  });

  it("stops on a cause that points back at itself", () => {
    const loop = new Error("loop") as Error & { cause?: unknown };
    loop.cause = loop;
    expect(isConnectionError(loop)).toBe(false);
  });
});
