import { defineAdmin, resource } from "@flowpanel/core";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ getAll: () => [] }),
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));

import { Flowpanel } from "../flowpanel-page";
import { Wall } from "../pages/wall";
import { adapter } from "./detail-fixture";

type Props = { children?: ReactNode; navGroups?: unknown[]; title?: string };

function find(
  node: ReactNode,
  match: (el: ReactElement<Props>) => boolean,
): ReactElement<Props> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = find(child, match);
      if (hit) return hit;
    }
    return null;
  }
  if (!isValidElement<Props>(node)) return null;
  if (match(node)) return node;
  return find(node.props.children, match);
}

describe("a page the rate limit refuses", () => {
  it("keeps the admin's navigation around a wall that says to wait", async () => {
    const config = defineAdmin({
      adapter,
      auth: { session: async () => ({ id: "u1" }), role: () => "admin", userId: () => "u1" },
      rateLimit: { driver: "memory", limit: 1, windowMs: 60_000 },
      resources: [resource({ __name: "users" }, { label: "Users", columns: ["id"] })],
    });
    const page = Flowpanel(config);
    const open = (n: number) =>
      page({
        params: Promise.resolve({ slug: ["users"] }),
        searchParams: Promise.resolve({ page: String(n) }),
      });

    await open(1);
    const refused = await open(2);
    const chrome = find(refused, (el) => Array.isArray(el.props.navGroups));
    expect(chrome?.props.navGroups).toHaveLength(1);
    expect(find(refused, (el) => el.type === Wall)?.props.title).toBe("Too many requests");
  });
});
