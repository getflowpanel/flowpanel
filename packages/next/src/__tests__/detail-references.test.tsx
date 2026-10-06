import { KVRow, ReferenceCell } from "@flowpanel/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { ResourceDetailPage } from "../pages/resource-detail";
import { admin, findAll } from "./detail-fixture";

async function recordRows(id: string): Promise<Record<string, unknown>[]> {
  const config = admin({ label: "Customer", columns: ["id", "email"] });
  const scores = config.resourcesByName.get("scores");
  if (!scores) throw new Error("fixture: scores not registered");
  const tree = await ResourceDetailPage({
    config,
    resource: scores,
    name: "scores",
    id,
    req: new Request(`http://localhost/admin/scores/${id}`),
  });
  return findAll(tree, KVRow);
}

const referenceIn = (value: unknown) => findAll(value as ReactNode, ReferenceCell)[0];

describe("a reference field on the record page", () => {
  it("reads as the referenced record's label with a link, as the list shows it", async () => {
    const owner = (await recordRows("s1")).find((row) => row.label === "Owner");
    expect(referenceIn(owner?.value)).toMatchObject({
      label: "ada@example.com",
      href: "/admin/users/u1",
    });
  });
});
