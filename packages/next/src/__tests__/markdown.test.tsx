// @vitest-environment happy-dom

import { defineAdmin, resource } from "@flowpanel/core";
import { cleanup, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { drawerRoute } from "../drawer/drawer-route";
import { renderDetailFields } from "../pages/detail-tabs/detail-cells";
import { markdownFields, renderMarkdown } from "../runtime/markdown";

function html(text: string): string {
  const { container } = render(<div>{renderMarkdown(text)}</div>);
  const out = container.innerHTML;
  cleanup();
  return out;
}

describe("a markdown field's text", () => {
  it("renders emphasis, code, links, lists and headings", () => {
    const out = html(
      "# Notes\n\n**Bold** and *soft* with `code`\nsecond line\n\n- one\n- [docs](https://example.com)",
    );
    expect(out).toContain('<p class="fp-font-semibold">Notes</p>');
    expect(out).toContain("<strong>Bold</strong>");
    expect(out).toContain("<em>soft</em>");
    expect(out).toContain(">code</code>");
    expect(out).toContain("with <code");
    expect(out).toContain("<li>one</li>");
    expect(out).toContain(
      '<a href="https://example.com" rel="noopener noreferrer" class="fp-underline">docs</a>',
    );
  });

  it("keeps HTML as text and drops a script link to its label", () => {
    const out = html("<img src=x onerror=alert(1)> [click](javascript:alert(1))");
    expect(out).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(out).not.toContain("<img");
    expect(out).not.toContain("javascript:");
    expect(out).toContain("click");
  });

  it("leaves underscores and stars inside words alone, and keeps parentheses in a link", () => {
    const out = html("user_id_field and 2*3*4 [wiki](https://en.wikipedia.org/wiki/A_(b))");
    expect(out).toContain("user_id_field and 2*3*4");
    expect(out).not.toContain("<em>");
    expect(out).toContain('href="https://en.wikipedia.org/wiki/A_(b)"');
  });

  it("links only to http, https, mailto and same-site paths", () => {
    const out = html(
      "[a](/customers/1) [b](/\\evil.com) [c](//evil.com) [d](#top) [e](mailto:a@b.co)",
    );
    expect(out).toContain('href="/customers/1"');
    expect(out).toContain('href="mailto:a@b.co"');
    expect(out).not.toContain("evil.com");
    expect(out).not.toContain('href="#top"');
  });

  it("renders nothing for an empty or non-text value", () => {
    expect(renderMarkdown("  ")).toBeNull();
    expect(renderMarkdown(null)).toBeNull();
  });
});

describe("a markdown field in the drawer", () => {
  it("arrives rendered, not as raw asterisks", async () => {
    const config = defineAdmin({
      adapter: {
        kind: "drizzle",
        db: {},
        introspect: () => ({
          name: "notes",
          primaryKey: "id",
          columns: [
            { name: "id", type: "number", nullable: false, unique: true, primaryKey: true },
            { name: "body", type: "string", nullable: true, unique: false, primaryKey: false },
          ],
        }),
        inferSchema: () => ({}) as never,
        list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
        get: async () => ({ id: 1, body: "**Ship** it" }),
        create: async () => ({}),
        update: async () => ({}),
        delete: async () => undefined,
      },
      auth: { session: async () => null, role: () => "admin" },
      resources: [
        resource(
          { __name: "notes" },
          {
            columns: ["id", "body"],
            create: { fields: [{ name: "body", type: "markdown" }] },
            drawer: { fields: "*" },
          },
        ),
      ],
    });
    const res = await drawerRoute(config)(
      new Request("http://localhost/api/flowpanel/drawer/notes/1"),
      {
        params: Promise.resolve({ resource: "notes", id: "1" }),
      },
    );
    const { prerendered } = (await res.json()) as { prerendered: Record<string, string> };
    expect(prerendered.body).toContain("<strong>Ship</strong> it");
  });
});

describe("a markdown field whose column renders it", () => {
  it("shows the column's own render in the drawer", async () => {
    const config = defineAdmin({
      adapter: {
        kind: "drizzle",
        db: {},
        introspect: () => ({
          name: "notes",
          primaryKey: "id",
          columns: [
            { name: "id", type: "number", nullable: false, unique: true, primaryKey: true },
            { name: "body", type: "string", nullable: true, unique: false, primaryKey: false },
          ],
        }),
        inferSchema: () => ({}) as never,
        list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
        get: async () => ({ id: 1, body: "**Ship** it" }),
        create: async () => ({}),
        update: async () => ({}),
        delete: async () => undefined,
      },
      auth: { session: async () => null, role: () => "admin" },
      resources: [
        resource(
          { __name: "notes" },
          {
            columns: ["id", { field: "body", render: () => "custom" }],
            create: { fields: [{ name: "body", type: "markdown" }] },
            drawer: { fields: "*" },
          },
        ),
      ],
    });
    const res = await drawerRoute(config)(
      new Request("http://localhost/api/flowpanel/drawer/notes/1"),
      {
        params: Promise.resolve({ resource: "notes", id: "1" }),
      },
    );
    const { prerendered } = (await res.json()) as { prerendered: Record<string, string> };
    expect(prerendered.body).toBe("custom");
  });
});

describe("a markdown field the host renders itself", () => {
  it("keeps the host's column render on the record page and in the drawer", () => {
    const notes = resource(
      { __name: "notes" },
      {
        columns: ["id", { field: "body", render: () => "custom" }],
        create: { fields: [{ name: "body", type: "markdown" }] },
      },
    );
    expect(markdownFields(notes).has("body")).toBe(false);
    const plain = resource(
      { __name: "notes" },
      {
        columns: ["id", "body"],
        create: { fields: [{ name: "body", type: "markdown" }] },
      },
    );
    expect(markdownFields(plain).has("body")).toBe(true);
  });
});

describe("a markdown field on the record page", () => {
  const reqCtx = {} as Parameters<typeof renderDetailFields>[2];
  const row = { id: 1, body: "**Ship** it" };
  const notes = (column: Record<string, unknown>) =>
    resource({ __name: "notes" }, {
      columns: ["id", { field: "body", ...column }],
      create: { fields: [{ name: "body", type: "markdown" }] },
    } as never);

  it("renders the text as markdown by default", async () => {
    const rendered = await renderDetailFields(
      row,
      [{ name: "body" }],
      reqCtx,
      markdownFields(notes({})),
    );
    const { container } = render(<div>{rendered.get("body")}</div>);
    expect(container.innerHTML).toContain("<strong>Ship</strong> it");
    cleanup();
  });

  it("leaves the field to its column's own format or render", async () => {
    for (const column of [{ format: "badge" }, { render: () => "custom" }]) {
      const rendered = await renderDetailFields(
        row,
        [{ name: "body" }],
        reqCtx,
        markdownFields(notes(column)),
      );
      expect(rendered.has("body")).toBe(false);
    }
  });
});

describe("markdown parsing speed", () => {
  it("renders 100k pathological characters in under 50 ms", () => {
    for (const input of [
      "[a".repeat(50_000),
      "[x](".repeat(25_000),
      "*a ".repeat(33_334),
      "\x60".repeat(100_000),
    ]) {
      const started = performance.now();
      renderMarkdown(input);
      expect(performance.now() - started).toBeLessThan(50);
    }
  });
});
