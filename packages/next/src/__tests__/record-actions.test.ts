import { defineAdmin, type ResourceOptions, resource } from "@flowpanel/core";
import { RecordActionsBar } from "@flowpanel/next/client";
import { PageHeader } from "@flowpanel/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { recordActions } from "../runtime/record-actions";
import { adapter, findAll, renderDetail } from "./detail-fixture";

const run = async () => ({ ok: true as const });

function admin(role: string, extra: { readOnly?: boolean } = {}) {
  return adminWith(role, extra, {});
}

function adminWith(
  role: string,
  extra: { readOnly?: boolean },
  more: ResourceOptions<Record<string, unknown>>,
) {
  return defineAdmin({
    adapter,
    auth: { session: async () => ({ id: "u1" }), role: () => role },
    ...extra,
    resources: [
      resource(
        { __name: "users" },
        {
          label: "Users",
          labelOne: "User",
          columns: ["id", "email"],
          access: { read: true, update: "admin", delete: "admin" },
          delete: { softDelete: "email", confirm: "Gone for good after 30 days." },
          actions: [
            { key: "retry", label: "Retry", run },
            { key: "promote", label: "Promote", access: "admin", run },
            { key: "only-pro", label: "Pro only", hidden: (row) => row.plan !== "pro", run },
          ],
          ...more,
        },
      ),
    ],
  });
}

function menuFor(role: string, row: Record<string, unknown>, deleted = false, readOnly = false) {
  const config = admin(role, readOnly ? { readOnly } : {});
  const users = config.resourcesByName.get("users");
  if (!users) throw new Error("fixture: users not registered");
  return recordActions(
    config,
    users,
    "users",
    "u1",
    { id: "u1", ...row },
    {
      req: new Request("http://localhost/admin/users/u1"),
      session: { id: "u1" },
      role,
      scope: null,
      ip: null,
      userAgent: null,
    },
    deleted,
  );
}

describe("a record's drawer actions", () => {
  it("decide `when` on the row the action route reads, not the page's projection", async () => {
    const config = adminWith(
      "admin",
      {},
      {
        drawer: {
          fields: ["email"],
          actions: [
            {
              key: "refund",
              label: "Refund",
              when: ({ current }) => Number(current?.spend) > 1000,
              run,
            },
            {
              key: "downgrade",
              label: "Downgrade",
              when: ({ current }) => current?.plan === "free",
              run,
            },
          ],
        },
      },
    );
    const users = config.resourcesByName.get("users");
    if (!users) throw new Error("fixture: users not registered");
    const menu = await recordActions(
      config,
      users,
      "users",
      "u1",
      { id: "u1", email: "x" },
      {
        req: new Request("http://localhost/admin/users/u1"),
        session: { id: "u1" },
        role: "admin",
        scope: null,
        ip: null,
        userAgent: null,
      },
      false,
    );
    expect(menu.drawerActions.map((action) => action.key)).toEqual(["refund"]);
  });
});

describe("a record's header menu", () => {
  it("carries the list's row actions for this row, `hidden` and `access` applied", async () => {
    const keys = async (role: string, plan: string) =>
      (await menuFor(role, { plan })).rowActions.map((action) => action.key);
    expect(await keys("admin", "pro")).toEqual(["retry", "promote", "only-pro"]);
    expect(await keys("admin", "free")).toEqual(["retry", "promote"]);
    expect(await keys("support", "pro")).toEqual(["retry", "only-pro"]);
  });

  it("offers Edit and Delete only to a role that may, with the resource's own confirm", async () => {
    const admin = await menuFor("admin", { plan: "pro" });
    expect(admin.editHref).toBe("/admin/users/u1/edit");
    expect(admin.delete).toEqual({
      label: "Delete",
      title: "Delete this user?",
      description: "Gone for good after 30 days.",
      successMessage: "User deleted",
      listHref: "/admin/users",
    });
    const support = await menuFor("support", { plan: "pro" });
    expect(support.editHref).toBeNull();
    expect(support.delete).toBeNull();
  });

  it("offers no Edit or Delete in a read-only admin and nothing at all on a deleted row", async () => {
    const readOnly = await menuFor("admin", {}, false, true);
    expect(readOnly.editHref).toBeNull();
    expect(readOnly.delete).toBeNull();
    expect(await menuFor("admin", { plan: "pro" }, true)).toEqual({
      rowActions: [],
      drawerActions: [],
      editHref: null,
      delete: null,
    });
  });
});

describe("the record page's menu", () => {
  it("also carries the drawer's own actions the caller may run on this row", async () => {
    const { tree } = await renderDetail({
      label: "User",
      columns: ["id"],
      drawer: {
        actions: [
          { key: "disable", label: "Disable user", placement: "inline", run },
          { key: "purge", label: "Purge", access: () => false, run },
          { key: "revive", label: "Revive", when: ({ current }) => current?.id !== "u1", run },
        ],
      },
    });
    const header = findAll(tree, PageHeader)[0]?.actions as ReactNode;
    const menu = findAll(header, RecordActionsBar)[0] as {
      drawerActions?: { key: string; placement?: string }[];
    };
    expect(menu.drawerActions).toEqual([
      { key: "disable", label: "Disable user", placement: "inline" },
    ]);
  });
});
