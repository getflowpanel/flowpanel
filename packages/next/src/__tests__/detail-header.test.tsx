import { PageHeader } from "@flowpanel/react";
import { describe, expect, it } from "vitest";
import { findAll, renderDetail } from "./detail-fixture";

type Row = Record<string, unknown>;

async function header(users: Parameters<typeof renderDetail>[0]) {
  const { tree } = await renderDetail(users);
  return findAll(tree, PageHeader)[0];
}

describe("the detail heading as configuration", () => {
  it("falls back to the resource label and readable key", async () => {
    expect((await header({ label: "Customer", columns: ["id"] }))?.title).toBe("Customer · u1");
  });

  it("uses title for the heading, subtitle for the line under it", async () => {
    const props = await header({
      label: "Customer",
      columns: ["id", "email"],
      detail: {
        title: (row: Row) => String(row.email),
        subtitle: (row: Row) => `id ${String(row.id)}`,
      },
    });
    expect(props?.title).toBe("ada@example.com");
    expect(props?.description).toBe("id u1");
  });

  it("prefers title over the deprecated header when both are declared", async () => {
    const props = await header({
      label: "Customer",
      columns: ["id", "email"],
      detail: {
        header: (row: Row) => `old ${String(row.email)}`,
        title: (row: Row) => `new ${String(row.email)}`,
      },
    });
    expect(props?.title).toBe("new ada@example.com");
  });

  it("keeps the deprecated header working on its own", async () => {
    const props = await header({
      label: "Customer",
      columns: ["id", "email"],
      detail: { header: (row: Row) => `old ${String(row.email)}` },
    });
    expect(props?.title).toBe("old ada@example.com");
  });

  it("falls back when title returns nothing", async () => {
    const props = await header({
      label: "Customer",
      columns: ["id"],
      detail: { title: () => null },
    });
    expect(props?.title).toBe("Customer · u1");
  });

  it("passes a badge through with its tone and omits it when nullish", async () => {
    const shown = await header({
      label: "Customer",
      columns: ["id", "plan"],
      detail: { badge: (row: Row) => ({ label: String(row.plan), tone: "ok" as const }) },
    });
    expect(shown?.badge).toEqual({ label: "pro", tone: "ok" });
    const absent = await header({
      label: "Customer",
      columns: ["id"],
      detail: { badge: () => null },
    });
    expect(absent?.badge).toBeUndefined();
  });

  it("gives subtitle and badge the projected row, not the adapter's", async () => {
    const seen: Row[] = [];
    await header({
      label: "Customer",
      columns: ["id"],
      detail: {
        subtitle: (row: Row) => {
          seen.push(row);
          return null;
        },
      },
    });
    expect(Object.keys(seen[0] ?? {})).toEqual(["id"]);
  });
});
