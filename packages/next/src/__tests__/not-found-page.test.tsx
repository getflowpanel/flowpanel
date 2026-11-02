// @vitest-environment happy-dom

import type { Adapter } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { cleanup, render, screen } from "@testing-library/react";
import { isValidElement, type ReactElement, type ReactNode, Suspense } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

let pathname = "/ops/nope";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ getAll: () => [] }),
}));

import { NotFoundBody, PathAwareShell } from "@flowpanel/next/client";
import { createFlowpanel } from "../create-flowpanel";

afterEach(cleanup);

const adapter = {
  kind: "test",
  introspect: () => ({ name: "x", columns: [] }),
} as never as Adapter;

type Props = { children?: ReactNode } & Record<string, unknown>;

function find(tree: ReactNode, type: unknown): ReactElement<Props> | null {
  if (Array.isArray(tree)) {
    for (const child of tree) {
      const hit = find(child, type);
      if (hit) return hit;
    }
    return null;
  }
  if (!isValidElement<Props>(tree)) return null;
  if (tree.type === type) return tree;
  return find(tree.props.children, type);
}

function admin(session: unknown) {
  return defineAdmin({
    adapter,
    auth: {
      session: async () => {
        if (session instanceof Error) throw session;
        return session as never;
      },
      role: () => "admin",
    },
    paths: { admin: "/ops", api: "/api/ops" },
    resources: [
      resource(
        { __name: "customers" },
        { label: "Customers", labelOne: "Customer", columns: ["id"] },
      ),
      resource({ __name: "secrets" }, { columns: ["id"], access: { read: "owner" } }),
    ],
  });
}

/** The page's streamed part, rendered the way the server would. */
async function streamed(config: ReturnType<typeof admin>): Promise<ReactNode> {
  const { notFound: NotFoundPage } = createFlowpanel(config);
  const boundary = find(NotFoundPage(), Suspense);
  const inner = boundary?.props.children;
  if (!isValidElement<Props>(inner) || typeof inner.type !== "function") {
    throw new Error("expected the shell part inside a Suspense boundary");
  }
  const chrome = await (inner.type as (props: Props) => Promise<ReactNode>)(inner.props);
  if (
    isValidElement<Props>(chrome) &&
    chrome.type !== NotFoundBody &&
    typeof chrome.type === "function"
  ) {
    return (chrome.type as (props: Props) => ReactNode)(chrome.props);
  }
  return chrome;
}

describe("createFlowpanel(config).notFound", () => {
  it("keeps the signed-in reader inside the admin shell", async () => {
    const tree = await streamed(admin({ id: "u1" }));
    const shell = find(tree, PathAwareShell);
    expect(shell?.props.navGroups).toEqual([
      expect.objectContaining({ items: [expect.objectContaining({ href: "/ops/customers" })] }),
    ]);
    const body = find(tree, NotFoundBody);
    expect(Object.keys((body?.props.records as object) ?? {})).toEqual(["customers"]);
  });

  it("falls back to the bare screen when the reader can't be identified", async () => {
    pathname = "/ops/customers/1";
    const tree = await streamed(admin(new Error("session store down")));
    expect(find(tree, PathAwareShell)).toBeNull();
    render(<div>{tree}</div>);
    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to admin" }).getAttribute("href")).toBe("/ops");
  });

  it("titles the page", () => {
    const { notFound: NotFoundPage } = createFlowpanel(
      defineAdmin({
        adapter,
        auth: { session: async () => null, role: () => "admin" },
        labels: { notFound: { title: "Nothing here" } },
      }),
    );
    const { container } = render(<NotFoundPage />);
    expect(document.title).toBe("Nothing here");
    expect(container.querySelector("[data-flowpanel-root]")).not.toBeNull();
  });
});

describe("the not-found message", () => {
  const props = {
    adminPath: "/ops",
    title: "Page not found",
    description: "This address doesn't match any page in this admin.",
    back: "Back to admin",
    recordDescription: "Check the link, or find it in the list.",
    records: {
      customers: {
        title: "This customer doesn't exist or was deleted",
        back: "Back to Customers",
        href: "/ops/customers",
      },
    },
  };

  it.each(["/ops/customers/999999", "/ops/customers/999999/edit", "/ops/customers/a%2Fb"])(
    "names the missing record at %s and leads back to its list",
    (path) => {
      pathname = path;
      render(<NotFoundBody {...props} />);
      expect(
        screen.getByRole("heading", {
          level: 1,
          name: "This customer doesn't exist or was deleted",
        }),
      ).toBeTruthy();
      expect(screen.getByRole("link", { name: "Back to Customers" }).getAttribute("href")).toBe(
        "/ops/customers",
      );
    },
  );

  it.each(["/ops/nope", "/ops/customers/1/nope", "/ops/secrets/1", "/elsewhere/customers/1"])(
    "says the address matches nothing at %s",
    (path) => {
      pathname = path;
      render(<NotFoundBody {...props} />);
      expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Back to admin" }).getAttribute("href")).toBe("/ops");
    },
  );
});
