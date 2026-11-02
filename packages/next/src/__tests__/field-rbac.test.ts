import type { RequestContext, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import {
  deniedFieldWrites,
  hiddenFormFields,
  resolveFormFields,
} from "../runtime/resolve-form-fields";

const ctx = (role: string): RequestContext => ({ role, session: null }) as RequestContext;

const resource = {
  ref: {},
  options: {
    fieldAccess: {
      internalNote: { read: "admin", write: "admin" },
      price: { write: "admin" },
      password: { sensitive: true, read: false },
      notes: { read: false, write: true },
    },
  },
} as unknown as ResourceConfig;

describe("form fields under fieldAccess", () => {
  const config = {
    adapter: { db: {} },
    resourcesByName: new Map(),
  } as unknown as ResolvedAdminConfig;
  const fields = [
    { name: "title" },
    { name: "internalNote" },
    { name: "price" },
    { name: "notes" },
  ];

  it("hides only a field the caller may neither read nor write", async () => {
    const guest = ctx("guest");
    const hidden = await hiddenFormFields(
      resource,
      guest,
      await deniedFieldWrites(resource, guest, null),
    );
    expect([...hidden]).toEqual(["internalNote"]);
    const admin = ctx("admin");
    expect([
      ...(await hiddenFormFields(resource, admin, await deniedFieldWrites(resource, admin, null))),
    ]).toEqual([]);
  });

  it("leaves out a field the caller may neither read nor write and locks one it may not write", async () => {
    const guest = ctx("guest");
    const denied = await deniedFieldWrites(resource, guest, null);
    expect([...denied].sort()).toEqual(["internalNote", "price"]);
    const asGuest = await resolveFormFields(
      config,
      fields,
      guest,
      undefined,
      denied,
      await hiddenFormFields(resource, guest, denied),
    );
    expect(asGuest.map((f) => [f.name, f.readOnly ?? false])).toEqual([
      ["title", false],
      ["price", true],
      ["notes", false],
    ]);
    const admin = ctx("admin");
    const adminDenied = await deniedFieldWrites(resource, admin, null);
    const asAdmin = await resolveFormFields(
      config,
      fields,
      admin,
      undefined,
      adminDenied,
      await hiddenFormFields(resource, admin, adminDenied),
    );
    expect(asAdmin.map((f) => f.name)).toEqual(["title", "internalNote", "price", "notes"]);
  });
});
