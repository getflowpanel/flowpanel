import { describe, expect, it } from "vitest";
import {
  createActionBuilder,
  createColumnBuilder,
  createFilterBuilder,
  resolveShorthandColumns,
  resolveShorthandFilters,
  titleCase,
  lastSegment,
} from "../builders";

// ---------------------------------------------------------------------------
// Helper tests
// ---------------------------------------------------------------------------

describe("titleCase", () => {
  it("converts camelCase to Title Case", () => {
    expect(titleCase("createdAt")).toBe("Created At");
  });

  it("converts single word", () => {
    expect(titleCase("email")).toBe("Email");
  });

  it("converts userId", () => {
    expect(titleCase("userId")).toBe("User Id");
  });

  it("already Title Case stays unchanged (no double-spaces)", () => {
    expect(titleCase("Name")).toBe("Name");
  });

  it("multi-segment camelCase", () => {
    expect(titleCase("firstName")).toBe("First Name");
  });
});

describe("lastSegment", () => {
  it("returns last segment of dot-path", () => {
    expect(lastSegment("user.email")).toBe("email");
  });

  it("returns the whole string for a single segment", () => {
    expect(lastSegment("email")).toBe("email");
  });

  it("handles deep paths", () => {
    expect(lastSegment("user.subscription.plan.name")).toBe("name");
  });
});

// ---------------------------------------------------------------------------
// ColumnBuilder
// ---------------------------------------------------------------------------

type UserRow = {
  id: number;
  email: string;
  createdAt: Date;
  user: { name: string };
};

describe("createColumnBuilder", () => {
  const c = createColumnBuilder<UserRow>();

  describe("field()", () => {
    it("resolves path and auto-labels from last segment", () => {
      const col = c.field((p) => p.email);
      expect(col.path).toBe("email");
      expect(col.label).toBe("Email");
      expect(col.type).toBe("field");
      expect(col.format).toBe("auto");
    });

    it("auto-labels nested path from last segment", () => {
      const col = c.field((p) => p.user.name);
      expect(col.path).toBe("user.name");
      expect(col.label).toBe("Name");
    });

    it("uses camelCase last segment as Title Case label", () => {
      const col = c.field((p) => p.createdAt);
      expect(col.label).toBe("Created At");
    });

    it("accepts explicit label override", () => {
      const col = c.field((p) => p.email, { label: "E-mail Address" });
      expect(col.label).toBe("E-mail Address");
    });

    it("merges opts into result", () => {
      const col = c.field((p) => p.email, { width: 200, sortable: true });
      expect(col.opts.width).toBe(200);
      expect(col.opts.sortable).toBe(true);
    });

    it("applies format from opts", () => {
      const col = c.field((p) => p.createdAt, { format: "relative" });
      expect(col.format).toBe("relative");
    });

    it("sets id from path", () => {
      const col = c.field((p) => p.email);
      expect(col.id).toBe("email");
    });

    it("nested path id uses full dot-path", () => {
      const col = c.field((p) => p.user.name);
      expect(col.id).toBe("user.name");
    });
  });

  describe("computed()", () => {
    it("creates a computed column with null path", () => {
      const col = c.computed("fullName", {
        label: "Full Name",
        compute: () => "Alice",
      });
      expect(col.type).toBe("computed");
      expect(col.path).toBeNull();
      expect(col.id).toBe("fullName");
      expect(col.label).toBe("Full Name");
    });

    it("stores compute function", () => {
      const compute = (row: UserRow) => String(row.id);
      const col = c.computed("strId", { label: "ID", compute });
      expect(col.compute).toBe(compute);
    });

    it("uses format from opts", () => {
      const col = c.computed("score", {
        label: "Score",
        format: "number",
        compute: () => 42,
      });
      expect(col.format).toBe("number");
    });

    it("defaults format to auto when not provided", () => {
      const col = c.computed("x", { label: "X", compute: () => 0 });
      expect(col.format).toBe("auto");
    });
  });

  describe("custom()", () => {
    it("creates a custom column with null path", () => {
      const renderFn = () => null;
      const col = c.custom({ id: "avatar", label: "Avatar", render: renderFn });
      expect(col.type).toBe("custom");
      expect(col.path).toBeNull();
      expect(col.id).toBe("avatar");
      expect(col.render).toBe(renderFn);
    });
  });
});

// ---------------------------------------------------------------------------
// FilterBuilder
// ---------------------------------------------------------------------------

describe("createFilterBuilder", () => {
  const f = createFilterBuilder<UserRow>();

  describe("filter()", () => {
    it("resolves path and auto-labels", () => {
      const filter = f.filter((p) => p.email);
      expect(filter.path).toBe("email");
      expect(filter.label).toBe("Email");
      expect(filter.mode).toBe("auto");
    });

    it("accepts opts including label override", () => {
      const filter = f.filter((p) => p.email, { label: "Email Address" });
      expect(filter.label).toBe("Email Address");
    });

    it("sets id from path", () => {
      const filter = f.filter((p) => p.email);
      expect(filter.id).toBe("email");
    });

    it("merges mode from opts", () => {
      const filter = f.filter((p) => p.email, { mode: "text" });
      expect(filter.mode).toBe("text");
    });

    it("stores opts", () => {
      const filter = f.filter((p) => p.email, { debounceMs: 300 });
      expect(filter.opts.debounceMs).toBe(300);
    });
  });

  describe("custom()", () => {
    it("creates a custom filter with given id and label", () => {
      const toWhere = (v: unknown) => ({ status: v });
      const filter = f.custom({
        id: "status",
        label: "Status",
        mode: "enum",
        toWhere,
      });
      expect(filter.id).toBe("status");
      expect(filter.label).toBe("Status");
      expect(filter.mode).toBe("enum");
      expect(filter.toWhere).toBe(toWhere);
    });
  });
});

// ---------------------------------------------------------------------------
// ActionBuilder
// ---------------------------------------------------------------------------

describe("createActionBuilder", () => {
  const a = createActionBuilder<UserRow>();

  describe("mutation()", () => {
    it("creates a resolved action with defaults", () => {
      const handler = async () => {};
      const action = a.mutation({ label: "Delete", handler });
      expect(action.type).toBe("mutation");
      expect(action.label).toBe("Delete");
      expect(action.variant).toBe("default");
      expect(action.id).toBe("");
      expect(action.handler).toBe(handler);
    });

    it("uses provided variant", () => {
      const action = a.mutation({ label: "Delete", variant: "danger", handler: async () => {} });
      expect(action.variant).toBe("danger");
    });

    it("wraps string confirm into ConfirmConfig", () => {
      const action = a.mutation({
        label: "Delete",
        confirm: "Are you sure?",
        handler: async () => {},
      });
      expect(action.confirm).toEqual({ title: "Are you sure?" });
    });

    it("passes ConfirmConfig as-is", () => {
      const confirm = { title: "Delete?", description: "This is permanent.", intent: "destructive" as const };
      const action = a.mutation({ label: "Delete", confirm, handler: async () => {} });
      expect(action.confirm).toBe(confirm);
    });

    it("passes through icon, onSuccess, when", () => {
      const when = (row: UserRow) => row.id > 0;
      const action = a.mutation({
        label: "Archive",
        icon: "archive",
        onSuccess: { toast: "Archived!" },
        when,
        handler: async () => {},
      });
      expect(action.icon).toBe("archive");
      expect(action.onSuccess).toEqual({ toast: "Archived!" });
      expect(action.when).toBe(when);
    });
  });
});

// ---------------------------------------------------------------------------
// Shorthand resolvers
// ---------------------------------------------------------------------------

describe("resolveShorthandColumns", () => {
  it("converts array of PathFns to ResolvedColumns", () => {
    const cols = resolveShorthandColumns<UserRow>([
      (p) => p.email,
      (p) => p.createdAt,
    ]);
    expect(cols).toHaveLength(2);
    expect(cols[0].path).toBe("email");
    expect(cols[1].path).toBe("createdAt");
    expect(cols[0].type).toBe("field");
  });

  it("auto-labels each column", () => {
    const cols = resolveShorthandColumns<UserRow>([(p) => p.createdAt]);
    expect(cols[0].label).toBe("Created At");
  });
});

describe("resolveShorthandFilters", () => {
  it("converts array of PathFns to ResolvedFilters", () => {
    const filters = resolveShorthandFilters<UserRow>([(p) => p.email]);
    expect(filters).toHaveLength(1);
    expect(filters[0].path).toBe("email");
    expect(filters[0].mode).toBe("auto");
  });
});
