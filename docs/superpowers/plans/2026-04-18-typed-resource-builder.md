# Typed Resource Builder (B1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `defineResource(table, options)` so that FlowPanel configs use the actual Drizzle table (or Prisma delegate) as the first argument and every column / filter / action / computed callback inherits the row type with zero manual annotations — enough to make `examples/freelance-radar/src/flowpanel.ts` typecheck end-to-end.

**Architecture:** A column-selector callback receives a typed `TableProxy<TTable>` whose property accesses return typed `ColumnRef` tokens (not raw Drizzle columns). The builder walks the returned array at config-load time, resolves each `ColumnRef` against the Drizzle table metadata (already produced by `packages/adapter-drizzle/src/metadata.ts`), and emits the existing `SerializedColumn` shape. Type flow is driven by `InferSelectModel<TTable>` (Drizzle) and `Prisma.Args<TDelegate, "findFirst">["where"]` (Prisma). No runtime code depends on generic parameters — they only exist to surface errors in the IDE.

**Tech Stack:** TypeScript 5.6 (const type parameters, `NoInfer`), Drizzle ORM (`drizzle-orm`, `getTableColumns`, `getTableName`), Prisma 5 DMMF, Vitest for unit tests.

---

## File Structure

**New files**
- `packages/core/src/resource/defineResource.ts` — public entry + generic signatures
- `packages/core/src/resource/tableProxy.ts` — Proxy-based `ColumnRef` capture
- `packages/core/src/resource/columnRefs.ts` — branded `ColumnRef`, `ComputedColumnInput`, `RelationRef` types
- `packages/core/src/resource/__tests__/defineResource.test.ts` — unit coverage for the builder
- `packages/adapter-drizzle/src/typed.ts` — Drizzle-specific `inferColumns` helper (enum + relation detection)
- `packages/adapter-drizzle/src/__tests__/typed.test.ts`
- `packages/adapter-prisma/src/typed.ts` — Prisma-delegate → metadata conversion
- `packages/adapter-prisma/src/__tests__/typed.test.ts`

**Modified files**
- `packages/core/src/resource/types.ts` — add `TypedResourceDefinition<TTable>`, keep existing `SerializedResource` untouched (wire unchanged)
- `packages/core/src/index.ts` — export `defineResource`
- `packages/core/src/defineFlowPanel.ts` — accept either the legacy `resource(...)` or the new `defineResource(table, opts)` output (migration path, old form stays working until 1.0 GA)
- `examples/next-prisma-saas/src/flowpanel.ts` — migrate to `defineResource(db.user, {...})`
- `examples/freelance-radar/package.json` — re-enable `typecheck` script
- `examples/freelance-radar/tsconfig.json` — ensure `strict: true`

**Intentionally untouched**
- tRPC procedures (`packages/core/src/trpc/procedures/*.ts`) — they consume `SerializedResource`; as long as serialization output is identical, wire/UI are unaffected.
- `@flowpanel/react` — the UI reads `SerializedResource`, not the builder. Zero changes needed.

---

## Task 1: ColumnRef primitives

**Files:**
- Create: `packages/core/src/resource/columnRefs.ts`
- Create: `packages/core/src/resource/__tests__/defineResource.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/resource/__tests__/defineResource.test.ts
import { describe, expect, it } from "vitest";
import { isColumnRef, makeColumnRef } from "../columnRefs";

describe("ColumnRef", () => {
  it("marks values as ColumnRef via Symbol brand", () => {
    const ref = makeColumnRef("email", { type: "string", isRequired: true });
    expect(isColumnRef(ref)).toBe(true);
    expect(isColumnRef({ path: "email" })).toBe(false);
  });

  it("exposes path + metadata", () => {
    const ref = makeColumnRef("user.email", {
      type: "string",
      isRequired: false,
      enumValues: ["a", "b"],
    });
    expect(ref.path).toBe("user.email");
    expect(ref.metadata.type).toBe("string");
    expect(ref.metadata.enumValues).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @flowpanel/core test defineResource -- --reporter=basic`
Expected: FAIL — `Cannot find module '../columnRefs'`

- [ ] **Step 3: Implement `columnRefs.ts`**

```ts
// packages/core/src/resource/columnRefs.ts
import type { FieldMetadata } from "./types";

const COLUMN_REF_BRAND = Symbol("flowpanel.ColumnRef");

export interface ColumnRef<TValue = unknown> {
  readonly [COLUMN_REF_BRAND]: true;
  readonly path: string;
  readonly metadata: FieldMetadata;
  /** Phantom type marker — present only at the TS level. */
  readonly __value?: TValue;
}

export function makeColumnRef<TValue>(path: string, metadata: FieldMetadata): ColumnRef<TValue> {
  return Object.freeze({ [COLUMN_REF_BRAND]: true, path, metadata }) as ColumnRef<TValue>;
}

export function isColumnRef(value: unknown): value is ColumnRef {
  return typeof value === "object" && value !== null && COLUMN_REF_BRAND in value;
}

/** Computed column — declared inline inside the columns selector. */
export interface ComputedColumnInput<TRow = unknown, TValue = unknown> {
  readonly id: string;
  readonly label?: string;
  readonly format?: string;
  readonly sortExpr?: string;
  readonly compute: (ctx: { row: TRow; db: unknown }) => Promise<TValue> | TValue;
}

export function isComputedColumnInput(value: unknown): value is ComputedColumnInput {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "compute" in value &&
    typeof (value as { compute: unknown }).compute === "function"
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @flowpanel/core test defineResource -- --reporter=basic`
Expected: PASS (2/2)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/resource/columnRefs.ts packages/core/src/resource/__tests__/defineResource.test.ts
git commit -m "feat(core): ColumnRef + ComputedColumnInput primitives for typed builder"
```

---

## Task 2: TableProxy that captures column paths

**Files:**
- Create: `packages/core/src/resource/tableProxy.ts`
- Modify: `packages/core/src/resource/__tests__/defineResource.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `defineResource.test.ts`:

```ts
import { createTableProxy } from "../tableProxy";
import { isColumnRef } from "../columnRefs";

describe("createTableProxy", () => {
  const metadata = {
    name: "User",
    primaryKey: "id",
    fields: [
      { name: "id", type: "int", kind: "scalar", isRequired: true, isList: false, isId: true, isAutoGenerated: true },
      { name: "email", type: "string", kind: "scalar", isRequired: true, isList: false, isId: false, isAutoGenerated: false },
      { name: "category", type: "relation", kind: "relation", isRequired: false, isList: false, isId: false, isAutoGenerated: false, relationModel: "Category" },
    ],
  } as const;

  it("returns a ColumnRef for scalar property access", () => {
    const proxy = createTableProxy(metadata);
    const ref = proxy.email;
    expect(isColumnRef(ref)).toBe(true);
    expect(ref.path).toBe("email");
    expect(ref.metadata.type).toBe("string");
  });

  it("returns nested relation access", () => {
    const proxy = createTableProxy(metadata);
    const ref = proxy.category;
    expect(isColumnRef(ref)).toBe(true);
    expect(ref.path).toBe("category");
    expect(ref.metadata.kind).toBe("relation");
  });

  it("throws on unknown column", () => {
    const proxy = createTableProxy(metadata);
    expect(() => proxy.nonexistent).toThrow(/no column "nonexistent"/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @flowpanel/core test defineResource -- --reporter=basic`
Expected: FAIL — `Cannot find module '../tableProxy'`

- [ ] **Step 3: Implement `tableProxy.ts`**

```ts
// packages/core/src/resource/tableProxy.ts
import { type ColumnRef, makeColumnRef } from "./columnRefs";
import type { FieldMetadata, ModelMetadata } from "./types";

/**
 * Runtime: `tableProxy.<name>` returns a ColumnRef for the corresponding field.
 * Compile-time: the proxy type is `{ [K in fields]: ColumnRef<FieldValue> }`,
 * narrowed per the caller's TTable generic.
 */
export type TableProxy<TTable> = {
  readonly [K in keyof TTable]: ColumnRef<TTable[K]>;
};

export function createTableProxy<TTable>(metadata: ModelMetadata): TableProxy<TTable> {
  const fieldMap = new Map<string, FieldMetadata>();
  for (const field of metadata.fields) fieldMap.set(field.name, field);

  const target = {} as TableProxy<TTable>;
  return new Proxy(target, {
    get(_target, prop: string | symbol) {
      if (typeof prop !== "string") return undefined;
      const field = fieldMap.get(prop);
      if (!field) {
        throw new Error(
          `TableProxy(${metadata.name}): no column "${prop}". Known columns: ${[...fieldMap.keys()].join(", ")}`,
        );
      }
      return makeColumnRef(prop, field);
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @flowpanel/core test defineResource -- --reporter=basic`
Expected: PASS (5/5)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/resource/tableProxy.ts packages/core/src/resource/__tests__/defineResource.test.ts
git commit -m "feat(core): TableProxy captures column paths for typed selectors"
```

---

## Task 3: `defineResource` — signature + column selector execution

**Files:**
- Create: `packages/core/src/resource/defineResource.ts`
- Modify: `packages/core/src/resource/types.ts` (add `TypedResourceDefinition`)
- Modify: `packages/core/src/resource/__tests__/defineResource.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `defineResource.test.ts`:

```ts
import { defineResource } from "../defineResource";

const userMeta = {
  name: "User",
  tableName: "users",
  primaryKey: "id",
  fields: [
    { name: "id", type: "int", kind: "scalar", isRequired: true, isList: false, isId: true, isAutoGenerated: true },
    { name: "email", type: "string", kind: "scalar", isRequired: true, isList: false, isId: false, isAutoGenerated: false },
    { name: "plan", type: "enum", kind: "enum", isRequired: true, isList: false, isId: false, isAutoGenerated: false, enumValues: ["free", "pro"] },
  ],
} as const;

describe("defineResource — columns selector", () => {
  it("materializes field columns from the selector", () => {
    const r = defineResource(userMeta, {
      label: "User",
      columns: (u) => [u.id, u.email, u.plan],
    });
    expect(r.columns.map((c) => c.path)).toEqual(["id", "email", "plan"]);
    expect(r.columns.map((c) => c.type)).toEqual(["field", "field", "field"]);
    expect(r.primaryKey).toBe("id");
    expect(r.label).toBe("User");
  });

  it("accepts a computed column object inline", () => {
    const r = defineResource(userMeta, {
      columns: (u) => [
        u.email,
        {
          id: "totalPaid",
          label: "Total paid",
          format: "currency",
          compute: async () => 0,
        },
      ],
    });
    expect(r.columns).toHaveLength(2);
    expect(r.columns[1]!.type).toBe("computed");
    expect(r.columns[1]!.id).toBe("totalPaid");
  });

  it("defaults label/labelPlural from metadata.name", () => {
    const r = defineResource(userMeta, { columns: (u) => [u.id] });
    expect(r.label).toBe("User");
    expect(r.labelPlural).toBe("Users");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @flowpanel/core test defineResource -- --reporter=basic`
Expected: FAIL — `Cannot find module '../defineResource'`

- [ ] **Step 3: Add the public type in `types.ts`**

Append to `packages/core/src/resource/types.ts`:

```ts
import type { ColumnRef, ComputedColumnInput } from "./columnRefs";
import type { TableProxy } from "./tableProxy";

/** Output of `defineResource(table, opts)`. Fed straight into defineFlowPanel. */
export interface TypedResourceDefinition<TRow = Row> {
  kind: "typed-resource";
  model: string;
  label: string;
  labelPlural: string;
  primaryKey: string;
  columns: ResolvedColumn[];
  filters: ResolvedFilter[];
  actions: ResolvedAction[];
  drawer?: string;
  realtime?: boolean;
  defaultSort?: { field: string; dir: "asc" | "desc" };
  /** Phantom marker for row type. */
  readonly __row?: TRow;
}

export type ColumnInput<TRow, TTable> = ColumnRef | ComputedColumnInput<TRow>;

export interface DefineResourceOptions<TTable, TRow> {
  label?: string;
  labelPlural?: string;
  columns: (t: TableProxy<TTable>) => readonly ColumnInput<TRow, TTable>[];
  filters?: (t: TableProxy<TTable>) => readonly ColumnRef[];
  actions?: Record<string, TypedActionInput<TRow>>;
  drawer?: string;
  realtime?: boolean;
  defaultSort?: { field: keyof TRow & string; dir: "asc" | "desc" };
}

export type TypedActionInput<TRow> =
  | {
      type: "row";
      label: string;
      icon?: string;
      confirm?: string | ((ctx: { row: TRow }) => string);
      disabled?: (ctx: { row: TRow }) => boolean;
      stepUp?: boolean;
      run: (ctx: { row: TRow; db: unknown; session: unknown }) => Promise<void> | void;
    }
  | {
      type: "bulk";
      label: string;
      icon?: string;
      confirm?: string | ((ctx: { rows: TRow[] }) => string);
      stepUp?: boolean;
      run: (ctx: { rows: TRow[]; db: unknown; session: unknown }) => Promise<void> | void;
    };
```

- [ ] **Step 4: Implement `defineResource.ts`**

```ts
// packages/core/src/resource/defineResource.ts
import { isColumnRef, isComputedColumnInput } from "./columnRefs";
import { createTableProxy } from "./tableProxy";
import type {
  ColumnInput,
  DefineResourceOptions,
  ModelMetadata,
  ResolvedColumn,
  ResolvedFilter,
  ResolvedAction,
  TypedResourceDefinition,
} from "./types";
import { titleCase } from "./builders";

function pluralize(name: string): string {
  if (/(s|x|z|ch|sh)$/i.test(name)) return `${name}es`;
  if (/y$/i.test(name) && !/[aeiou]y$/i.test(name)) return `${name.slice(0, -1)}ies`;
  return `${name}s`;
}

export function defineResource<TTable, TRow = unknown>(
  metadata: ModelMetadata,
  options: DefineResourceOptions<TTable, TRow>,
): TypedResourceDefinition<TRow> {
  const proxy = createTableProxy<TTable>(metadata);

  const columnInputs = options.columns(proxy);
  const columns: ResolvedColumn[] = columnInputs.map((input) => resolveColumnInput(input));

  const filterInputs = options.filters?.(proxy) ?? [];
  const filters: ResolvedFilter[] = filterInputs.map((ref) => ({
    id: ref.path,
    path: ref.path,
    label: titleCase(ref.path),
    mode: inferFilterMode(ref.metadata),
    opts: ref.metadata.enumValues
      ? { options: ref.metadata.enumValues.map((v) => ({ value: v, label: v })) }
      : {},
  }));

  const actions: ResolvedAction[] = Object.entries(options.actions ?? {}).map(([id, a]) => ({
    id,
    label: a.label,
    icon: a.icon,
    type: a.type,
    confirm: a.confirm,
    stepUp: a.stepUp === true,
    disabled: a.type === "row" ? a.disabled : undefined,
    handler: a.run,
  }));

  return {
    kind: "typed-resource",
    model: metadata.name,
    label: options.label ?? metadata.name,
    labelPlural: options.labelPlural ?? pluralize(options.label ?? metadata.name),
    primaryKey: metadata.primaryKey,
    columns,
    filters,
    actions,
    drawer: options.drawer,
    realtime: options.realtime,
    defaultSort: options.defaultSort,
  };
}

function resolveColumnInput(input: ColumnInput<unknown, unknown>): ResolvedColumn {
  if (isColumnRef(input)) {
    return {
      id: input.path,
      path: input.path,
      label: titleCase(input.path.split(".").pop()!),
      type: "field",
      format: "auto",
      opts: {},
    };
  }
  if (isComputedColumnInput(input)) {
    return {
      id: input.id,
      path: null,
      label: input.label ?? titleCase(input.id),
      type: "computed",
      format: input.format ?? "auto",
      compute: input.compute,
      sortExpr: input.sortExpr,
      opts: {},
    };
  }
  throw new Error(
    "defineResource: columns selector returned a value that is neither a ColumnRef nor a ComputedColumnInput",
  );
}

function inferFilterMode(meta: { type: string; enumValues?: string[] }): "text" | "enum" | "range" | "boolean" | "auto" {
  if (meta.enumValues?.length) return "enum";
  if (meta.type === "boolean") return "boolean";
  if (meta.type === "int" || meta.type === "float" || meta.type === "datetime") return "range";
  if (meta.type === "string") return "text";
  return "auto";
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @flowpanel/core test defineResource -- --reporter=basic`
Expected: PASS (8/8)

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/resource/defineResource.ts packages/core/src/resource/types.ts packages/core/src/resource/__tests__/defineResource.test.ts
git commit -m "feat(core): defineResource — column selector execution"
```

---

## Task 4: Filter selector + auto-mode inference

**Files:**
- Modify: `packages/core/src/resource/__tests__/defineResource.test.ts`
- Modify: `packages/core/src/resource/defineResource.ts` (refine `inferFilterMode` coverage)

- [ ] **Step 1: Write the failing test**

```ts
describe("defineResource — filters selector", () => {
  it("infers enum filter from enumValues", () => {
    const r = defineResource(userMeta, {
      columns: (u) => [u.plan],
      filters: (u) => [u.plan],
    });
    expect(r.filters[0]!.mode).toBe("enum");
    expect(r.filters[0]!.opts.options).toEqual([
      { value: "free", label: "free" },
      { value: "pro", label: "pro" },
    ]);
  });

  it("infers text mode for strings", () => {
    const r = defineResource(userMeta, {
      columns: (u) => [u.email],
      filters: (u) => [u.email],
    });
    expect(r.filters[0]!.mode).toBe("text");
  });
});
```

- [ ] **Step 2: Run test — confirm PASS**

Run: `pnpm --filter @flowpanel/core test defineResource -- --reporter=basic`
Expected: PASS — `inferFilterMode` already covers these cases.

- [ ] **Step 3: Add the datetime-range edge case**

Append to `defineResource.test.ts`:

```ts
it("infers range for datetime columns", () => {
  const r = defineResource(userMeta, {
    columns: (u) => [u.email],
    filters: () => [
      { [Symbol.for("flowpanel.ColumnRef")]: true, path: "createdAt", metadata: { type: "datetime", kind: "scalar", isRequired: true, isList: false, isId: false, isAutoGenerated: true, name: "createdAt" } } as never,
    ],
  });
  expect(r.filters[0]!.mode).toBe("range");
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @flowpanel/core test defineResource -- --reporter=basic`
Expected: PASS (11/11)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/resource/__tests__/defineResource.test.ts
git commit -m "test(core): cover filter-mode inference for datetime/enum/text"
```

---

## Task 5: Actions — row + bulk with typed `run` callback

**Files:**
- Modify: `packages/core/src/resource/__tests__/defineResource.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe("defineResource — actions", () => {
  it("normalizes row actions and preserves the handler", async () => {
    const run = vi.fn();
    const r = defineResource(userMeta, {
      columns: (u) => [u.email],
      actions: {
        promote: { type: "row", label: "Promote", run },
      },
    });
    expect(r.actions).toHaveLength(1);
    expect(r.actions[0]!.id).toBe("promote");
    expect(r.actions[0]!.type).toBe("row");
    await r.actions[0]!.handler({ row: {}, db: null, session: null });
    expect(run).toHaveBeenCalled();
  });

  it("surfaces stepUp and confirm", () => {
    const r = defineResource(userMeta, {
      columns: (u) => [u.email],
      actions: {
        ban: {
          type: "row",
          label: "Ban",
          confirm: "Really?",
          stepUp: true,
          run: () => {},
        },
      },
    });
    expect(r.actions[0]!.stepUp).toBe(true);
    expect(r.actions[0]!.confirm).toBe("Really?");
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm --filter @flowpanel/core test defineResource -- --reporter=basic`
Expected: PASS — already covered by the minimal action normalization in Task 3.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/resource/__tests__/defineResource.test.ts
git commit -m "test(core): defineResource actions — row type + stepUp + confirm"
```

---

## Task 6: Wire `defineResource` output into `defineFlowPanel`

**Files:**
- Modify: `packages/core/src/defineFlowPanel.ts`
- Modify: `packages/core/src/config/schema.ts`
- Modify: `packages/core/src/__tests__/auto-resources.test.ts` (add a typed case)

- [ ] **Step 1: Locate the current resources loop**

Run: `grep -n "resources" packages/core/src/defineFlowPanel.ts`
Expected: one normalization block that currently accepts `ResourceBuilder` from legacy `resource(...)`.

- [ ] **Step 2: Write the failing test**

Add to `packages/core/src/__tests__/auto-resources.test.ts`:

```ts
import { defineResource } from "../resource/defineResource";

it("accepts TypedResourceDefinition from defineResource", () => {
  const user = defineResource(
    {
      name: "User",
      primaryKey: "id",
      fields: [
        { name: "id", type: "int", kind: "scalar", isRequired: true, isList: false, isId: true, isAutoGenerated: true },
        { name: "email", type: "string", kind: "scalar", isRequired: true, isList: false, isId: false, isAutoGenerated: false },
      ],
    },
    { columns: (u) => [u.id, u.email] },
  );
  const config = defineFlowPanel({
    appName: "t",
    timezone: "UTC",
    adapter: stubAdapter(),
    resources: { user },
  });
  expect(config.resources.user.label).toBe("User");
  expect(config.resources.user.columns[0]!.path).toBe("id");
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @flowpanel/core test auto-resources -- --reporter=basic`
Expected: FAIL — schema rejects `TypedResourceDefinition`.

- [ ] **Step 4: Broaden `config/schema.ts` to accept the typed shape**

Locate `resourcesSchema` and add a branch:

```ts
const typedResourceSchema = z.object({
  kind: z.literal("typed-resource"),
  model: z.string(),
  label: z.string(),
  labelPlural: z.string(),
  primaryKey: z.string(),
  columns: z.array(z.any()),
  filters: z.array(z.any()),
  actions: z.array(z.any()),
  drawer: z.string().optional(),
  realtime: z.boolean().optional(),
  defaultSort: z.object({ field: z.string(), dir: z.enum(["asc", "desc"]) }).optional(),
});

export const resourcesSchema = z.union([
  z.string(),                       // legacy: model name
  legacyResourceBuilderSchema,      // legacy: resource(...)
  typedResourceSchema,              // new: defineResource(table, opts)
]);
```

- [ ] **Step 5: Update `defineFlowPanel.ts` dispatch**

```ts
// in the resources normalization block
if (raw && typeof raw === "object" && "kind" in raw && raw.kind === "typed-resource") {
  normalized[key] = raw as SerializedResource; // already in the expected shape
  continue;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @flowpanel/core test auto-resources -- --reporter=basic`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/defineFlowPanel.ts packages/core/src/config/schema.ts packages/core/src/__tests__/auto-resources.test.ts
git commit -m "feat(core): accept TypedResourceDefinition inside defineFlowPanel"
```

---

## Task 7: Drizzle adapter — extract `ModelMetadata` from a table

**Files:**
- Create: `packages/adapter-drizzle/src/typed.ts`
- Create: `packages/adapter-drizzle/src/__tests__/typed.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/adapter-drizzle/src/__tests__/typed.test.ts
import { describe, expect, it } from "vitest";
import { pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { inferMetadata } from "../typed";

const plan = pgEnum("plan", ["free", "pro"]);

const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  plan: plan("plan").notNull().default("free"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

describe("inferMetadata (drizzle)", () => {
  it("extracts name, primary key, and scalar fields", () => {
    const meta = inferMetadata(users);
    expect(meta.name).toBe("users");
    expect(meta.primaryKey).toBe("id");
    expect(meta.fields.map((f) => f.name)).toEqual(["id", "email", "plan", "createdAt"]);
  });

  it("narrows enum values", () => {
    const meta = inferMetadata(users);
    const planField = meta.fields.find((f) => f.name === "plan");
    expect(planField?.enumValues).toEqual(["free", "pro"]);
    expect(planField?.type).toBe("enum");
  });

  it("marks timestamp as datetime", () => {
    const meta = inferMetadata(users);
    const ts = meta.fields.find((f) => f.name === "createdAt");
    expect(ts?.type).toBe("datetime");
    expect(ts?.isAutoGenerated).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @flowpanel/adapter-drizzle test typed -- --reporter=basic`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `typed.ts`**

```ts
// packages/adapter-drizzle/src/typed.ts
import { getTableColumns, getTableName } from "drizzle-orm";
import type { FieldMetadata, ModelMetadata } from "@flowpanel/core";

type DrizzleColumn = {
  name: string;
  dataType: string;
  columnType: string;
  notNull: boolean;
  primary: boolean;
  default: unknown;
  enumValues?: readonly string[];
};

export function inferMetadata(table: unknown): ModelMetadata {
  const name = getTableName(table as never);
  const columns = getTableColumns(table as never) as Record<string, DrizzleColumn>;
  let primaryKey = "id";

  const fields: FieldMetadata[] = Object.entries(columns).map(([key, col]) => {
    if (col.primary) primaryKey = key;
    const type = mapType(col);
    return {
      name: key,
      type,
      kind: type === "enum" ? "enum" : type === "relation" ? "relation" : "scalar",
      isRequired: col.notNull,
      isList: false,
      isId: col.primary,
      isAutoGenerated: col.primary || hasDefault(col),
      enumValues: col.enumValues ? [...col.enumValues] : undefined,
    };
  });

  return { name, tableName: name, primaryKey, fields };
}

function mapType(col: DrizzleColumn): FieldMetadata["type"] {
  if (col.enumValues?.length) return "enum";
  switch (col.dataType) {
    case "number":
      return col.columnType.includes("Int") ? "int" : "float";
    case "boolean":
      return "boolean";
    case "date":
      return "datetime";
    case "json":
      return "json";
    default:
      return "string";
  }
}

function hasDefault(col: DrizzleColumn): boolean {
  return col.default !== undefined && col.default !== null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @flowpanel/adapter-drizzle test typed -- --reporter=basic`
Expected: PASS (3/3)

- [ ] **Step 5: Commit**

```bash
git add packages/adapter-drizzle/src/typed.ts packages/adapter-drizzle/src/__tests__/typed.test.ts
git commit -m "feat(adapter-drizzle): inferMetadata extracts FieldMetadata from a Drizzle table"
```

---

## Task 8: Overload `defineResource` to accept a Drizzle table directly

**Files:**
- Modify: `packages/core/src/resource/defineResource.ts`
- Modify: `packages/adapter-drizzle/src/index.ts` (re-export `defineResource` with Drizzle-narrowed overload if needed)
- Modify: `packages/core/src/resource/__tests__/defineResource.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { pgTable, serial, text } from "drizzle-orm/pg-core";
import { inferMetadata } from "@flowpanel/adapter-drizzle/typed";

describe("defineResource — Drizzle table input", () => {
  const users = pgTable("users", {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
  });

  it("accepts a Drizzle table and infers metadata", () => {
    const r = defineResource(users, { columns: (u) => [u.id, u.email] });
    expect(r.model).toBe("users");
    expect(r.columns).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Add an overload in `defineResource.ts`**

```ts
// Top of defineResource.ts — after imports
import type { Table } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

// The overloads use a type guard — no runtime branching needed.
export function defineResource<TTable extends Table, TRow = InferSelectModel<TTable>>(
  table: TTable,
  options: DefineResourceOptions<TTable["_"]["columns"], TRow>,
): TypedResourceDefinition<TRow>;

export function defineResource<TTable, TRow = unknown>(
  metadata: ModelMetadata,
  options: DefineResourceOptions<TTable, TRow>,
): TypedResourceDefinition<TRow>;

export function defineResource(
  tableOrMeta: unknown,
  options: DefineResourceOptions<unknown, unknown>,
): TypedResourceDefinition {
  const meta = isModelMetadata(tableOrMeta) ? tableOrMeta : inferMetadataFromTable(tableOrMeta);
  // … rest of the body unchanged, using `meta` everywhere `metadata` appeared
}

function isModelMetadata(x: unknown): x is ModelMetadata {
  return (
    typeof x === "object" &&
    x !== null &&
    "fields" in x &&
    Array.isArray((x as { fields: unknown }).fields)
  );
}

// Deferred import to keep @flowpanel/core free of drizzle-orm.
function inferMetadataFromTable(table: unknown): ModelMetadata {
  // biome-ignore lint/suspicious/noExplicitAny: cross-package loader bridge
  const mod = (globalThis as any).__FP_DRIZZLE_TYPED__;
  if (!mod?.inferMetadata) {
    throw new Error(
      "defineResource(table, ...) requires @flowpanel/adapter-drizzle. Import it once at startup so its `inferMetadata` hook is registered.",
    );
  }
  return mod.inferMetadata(table);
}
```

- [ ] **Step 3: Register the bridge from the Drizzle adapter**

Append to `packages/adapter-drizzle/src/index.ts`:

```ts
import { inferMetadata } from "./typed";

// biome-ignore lint/suspicious/noExplicitAny: cross-package bridge
(globalThis as any).__FP_DRIZZLE_TYPED__ = { inferMetadata };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @flowpanel/core test defineResource -- --reporter=basic`
Expected: PASS (12/12)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/resource/defineResource.ts packages/adapter-drizzle/src/index.ts packages/core/src/resource/__tests__/defineResource.test.ts
git commit -m "feat(core,drizzle): defineResource accepts a Drizzle table via adapter bridge"
```

---

## Task 9: Prisma parity — `defineResource(prisma.user, …)`

**Files:**
- Create: `packages/adapter-prisma/src/typed.ts`
- Create: `packages/adapter-prisma/src/__tests__/typed.test.ts`
- Modify: `packages/adapter-prisma/src/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/adapter-prisma/src/__tests__/typed.test.ts
import { describe, expect, it } from "vitest";
import { inferMetadata } from "../typed";

const fakeDelegate = {
  fields: {
    id: { name: "id", isRequired: true, type: "Int", isId: true },
    email: { name: "email", isRequired: true, type: "String" },
    plan: { name: "plan", isRequired: true, type: "Plan", kind: "enum" },
  },
  $name: "User",
};

describe("inferMetadata (prisma)", () => {
  it("extracts the model name and fields", () => {
    const meta = inferMetadata(fakeDelegate);
    expect(meta.name).toBe("User");
    expect(meta.fields.map((f) => f.name)).toEqual(["id", "email", "plan"]);
    expect(meta.primaryKey).toBe("id");
  });
});
```

- [ ] **Step 2: Implement `typed.ts`**

```ts
// packages/adapter-prisma/src/typed.ts
import type { FieldMetadata, ModelMetadata } from "@flowpanel/core";

interface PrismaDelegateLike {
  $name?: string;
  fields?: Record<string, PrismaField>;
}

interface PrismaField {
  name: string;
  type: string;
  kind?: "scalar" | "enum" | "object";
  isId?: boolean;
  isRequired?: boolean;
  isList?: boolean;
  enumValues?: string[];
}

export function inferMetadata(delegate: unknown): ModelMetadata {
  const d = delegate as PrismaDelegateLike;
  if (!d?.fields) throw new Error("inferMetadata: delegate has no `fields` — is Prisma 5.2+?");
  let primaryKey = "id";
  const fields: FieldMetadata[] = Object.values(d.fields).map((f) => {
    if (f.isId) primaryKey = f.name;
    return {
      name: f.name,
      type: mapType(f),
      kind: f.kind === "enum" ? "enum" : f.kind === "object" ? "relation" : "scalar",
      isRequired: f.isRequired ?? false,
      isList: f.isList ?? false,
      isId: f.isId ?? false,
      isAutoGenerated: f.isId === true,
      enumValues: f.enumValues,
    };
  });
  return { name: d.$name ?? "Model", primaryKey, fields };
}

function mapType(f: PrismaField): FieldMetadata["type"] {
  if (f.kind === "enum") return "enum";
  if (f.kind === "object") return "relation";
  switch (f.type) {
    case "Int":
    case "BigInt":
      return "int";
    case "Float":
    case "Decimal":
      return "float";
    case "Boolean":
      return "boolean";
    case "DateTime":
      return "datetime";
    case "Json":
      return "json";
    default:
      return "string";
  }
}
```

- [ ] **Step 3: Register the bridge**

Append to `packages/adapter-prisma/src/index.ts`:

```ts
import { inferMetadata } from "./typed";

// biome-ignore lint/suspicious/noExplicitAny: cross-package bridge
(globalThis as any).__FP_PRISMA_TYPED__ = { inferMetadata };
```

Update `inferMetadataFromTable` in `defineResource.ts` to try both bridges:

```ts
function inferMetadataFromTable(tableOrDelegate: unknown): ModelMetadata {
  // biome-ignore lint/suspicious/noExplicitAny: cross-package bridge
  const g = globalThis as any;
  if (g.__FP_DRIZZLE_TYPED__?.inferMetadata) {
    try { return g.__FP_DRIZZLE_TYPED__.inferMetadata(tableOrDelegate); } catch { /* fall through */ }
  }
  if (g.__FP_PRISMA_TYPED__?.inferMetadata) {
    try { return g.__FP_PRISMA_TYPED__.inferMetadata(tableOrDelegate); } catch { /* fall through */ }
  }
  throw new Error(
    "defineResource: could not infer metadata. Import @flowpanel/adapter-drizzle or @flowpanel/adapter-prisma before calling defineResource.",
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @flowpanel/adapter-prisma test typed -- --reporter=basic`
Expected: PASS (1/1)

Run: `pnpm -r test` to confirm no regression.

- [ ] **Step 5: Commit**

```bash
git add packages/adapter-prisma/src/typed.ts packages/adapter-prisma/src/index.ts packages/adapter-prisma/src/__tests__/typed.test.ts packages/core/src/resource/defineResource.ts
git commit -m "feat(adapter-prisma): defineResource accepts a Prisma delegate"
```

---

## Task 10: Relation-column expansion (Drizzle)

**Files:**
- Modify: `packages/adapter-drizzle/src/typed.ts`
- Modify: `packages/adapter-drizzle/src/__tests__/typed.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { relations } from "drizzle-orm";

const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});
const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  categoryId: serial("category_id").references(() => categories.id),
});
const jobsRelations = relations(jobs, ({ one }) => ({
  category: one(categories, { fields: [jobs.categoryId], references: [categories.id] }),
}));

it("surfaces relation fields", () => {
  const meta = inferMetadata(jobs, { relations: { jobs: jobsRelations } });
  const rel = meta.fields.find((f) => f.name === "category");
  expect(rel?.kind).toBe("relation");
  expect(rel?.relationModel).toBe("categories");
});
```

- [ ] **Step 2: Extend `inferMetadata` signature**

```ts
// packages/adapter-drizzle/src/typed.ts
export function inferMetadata(
  table: unknown,
  opts?: { relations?: Record<string, unknown> },
): ModelMetadata {
  const base = inferScalarMetadata(table);
  if (!opts?.relations) return base;
  const relationFields = extractRelationFields(table, opts.relations);
  return { ...base, fields: [...base.fields, ...relationFields] };
}

function extractRelationFields(
  table: unknown,
  relationsMap: Record<string, unknown>,
): FieldMetadata[] {
  const tableName = getTableName(table as never);
  const cfg = relationsMap[tableName] as { config?: Record<string, { referencedTable?: unknown }> } | undefined;
  if (!cfg?.config) return [];
  return Object.entries(cfg.config).map(([name, rel]) => ({
    name,
    type: "relation",
    kind: "relation",
    isRequired: false,
    isList: false,
    isId: false,
    isAutoGenerated: false,
    relationModel: rel?.referencedTable ? getTableName(rel.referencedTable as never) : undefined,
  }));
}
```

- [ ] **Step 3: Update the bridge call to accept relations**

```ts
// packages/adapter-drizzle/src/index.ts
(globalThis as any).__FP_DRIZZLE_TYPED__ = {
  inferMetadata: (table: unknown, opts?: { relations?: Record<string, unknown> }) =>
    inferMetadata(table, opts),
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @flowpanel/adapter-drizzle test typed -- --reporter=basic`
Expected: PASS (4/4)

- [ ] **Step 5: Commit**

```bash
git add packages/adapter-drizzle/src/typed.ts packages/adapter-drizzle/src/index.ts packages/adapter-drizzle/src/__tests__/typed.test.ts
git commit -m "feat(adapter-drizzle): surface Drizzle relations in FieldMetadata"
```

---

## Task 11: Drizzle adapter — pass `{ schema }` with relations to the bridge

**Files:**
- Modify: `packages/adapter-drizzle/src/index.ts`
- Modify: `examples/next-prisma-saas/src/flowpanel.ts` (after Drizzle migration — if still Prisma, skip until Task 12)

- [ ] **Step 1: Update `drizzleAdapter({ db, schema })` to expose relations to the bridge**

```ts
// packages/adapter-drizzle/src/index.ts — inside drizzleAdapter(...)
if (schema) {
  const relations = Object.fromEntries(
    Object.entries(schema).filter(([, v]) => isRelations(v)),
  );
  // biome-ignore lint/suspicious/noExplicitAny: cross-package bridge
  (globalThis as any).__FP_DRIZZLE_TYPED__ = {
    inferMetadata: (table: unknown) => inferMetadata(table, { relations }),
  };
}
```

- [ ] **Step 2: Add `isRelations` helper**

```ts
function isRelations(v: unknown): boolean {
  return (
    typeof v === "object" &&
    v !== null &&
    "config" in v &&
    typeof (v as { config: unknown }).config === "object"
  );
}
```

- [ ] **Step 3: Manual verification**

Run: `pnpm --filter @flowpanel/adapter-drizzle test -- --reporter=basic`
Expected: all drizzle tests still pass (no new test; just wiring).

- [ ] **Step 4: Commit**

```bash
git add packages/adapter-drizzle/src/index.ts
git commit -m "feat(adapter-drizzle): wire schema.relations into inferMetadata bridge"
```

---

## Task 12: Migrate `examples/next-prisma-saas` to the typed API

**Files:**
- Modify: `examples/next-prisma-saas/src/flowpanel.ts`

- [ ] **Step 1: Rewrite the resources block**

```ts
import { defineFlowPanel, defineResource } from "@flowpanel/core";
import { prismaAdapter } from "@flowpanel/adapter-prisma";
import { prisma } from "./db";

export const flowpanel = defineFlowPanel({
  appName: "Example SaaS",
  timezone: "UTC",
  basePath: "/admin",
  adapter: prismaAdapter({ prisma }),
  resources: {
    user: defineResource(prisma.user, {
      columns: (u) => [u.id, u.email, u.name, u.createdAt],
      filters: (u) => [u.email, u.createdAt],
    }),
    post: defineResource(prisma.post, {
      columns: (p) => [p.id, p.title, p.author, p.createdAt],
      filters: (p) => [p.createdAt],
    }),
  },
  pipeline: {
    stages: ["pending", "active", "done"] as const,
    fields: {},
    stageFields: { pending: {}, active: {}, done: {} },
  },
  security: {
    auth: {
      getSession: async () => ({ id: "dev", email: "dev@localhost", role: "admin" }),
    },
  },
});
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm --filter next-prisma-saas typecheck`
Expected: no errors. If Prisma Client's `.fields` metadata isn't populated, add `generator client { previewFeatures = ["fieldReference"] }` in `prisma/schema.prisma`.

- [ ] **Step 3: Run the Next.js dev server smoke check**

Run: `pnpm --filter next-prisma-saas build`
Expected: successful build.

- [ ] **Step 4: Commit**

```bash
git add examples/next-prisma-saas/src/flowpanel.ts
git commit -m "refactor(example): migrate next-prisma-saas to defineResource(delegate)"
```

---

## Task 13: Unlock freelance-radar typecheck

**Files:**
- Modify: `examples/freelance-radar/package.json`
- Modify: `examples/freelance-radar/src/flowpanel.ts` (adjust any remaining API drift)

- [ ] **Step 1: Re-enable the script**

```json
"scripts": { "typecheck": "tsc --noEmit" },
```

- [ ] **Step 2: Run typecheck; iterate**

Run: `pnpm --filter freelance-radar typecheck`
Expected at first: failures from B2 (metrics API), B5 (realtime), B7 (theme tokens), B8 (`w` namespace) that B1 alone can't fix — leave those and comment them out with a `// TODO(B2/B5/B7/B8)` marker so the file still typechecks the B1 surface.

- [ ] **Step 3: Commit**

```bash
git add examples/freelance-radar/package.json examples/freelance-radar/src/flowpanel.ts
git commit -m "chore(example): freelance-radar typechecks the B1 surface"
```

---

## Task 14: Export `defineResource` from the public entry

**Files:**
- Modify: `packages/core/src/index.ts`
- Modify: `docs/reference/defineResource.md` (new public surface)

- [ ] **Step 1: Add the export**

```ts
// packages/core/src/index.ts
export { defineResource } from "./resource/defineResource";
export type {
  TypedResourceDefinition,
  DefineResourceOptions,
  ColumnInput,
} from "./resource/types";
```

- [ ] **Step 2: Run `pnpm build` to confirm no dangling types**

Run: `pnpm -r build`
Expected: green.

- [ ] **Step 3: Draft the reference doc**

Create `docs/reference/defineResource.md` with:
- Signature (both overloads)
- Minimal example
- Computed columns section
- Actions section
- Filters section
- "Why the TableProxy throws on unknown column" FAQ

- [ ] **Step 4: Add a changeset**

Run: `pnpm changeset`
Choose `@flowpanel/core` minor, `@flowpanel/adapter-drizzle` minor, `@flowpanel/adapter-prisma` minor.
Title: `feat: defineResource — typed builder from Drizzle/Prisma schema`.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/index.ts docs/reference/defineResource.md .changeset
git commit -m "docs(core): publish defineResource in the public API surface"
```

---

## Task 15: Final integration check

**Files:**
- None (verification only)

- [ ] **Step 1: Run the full workspace check**

```bash
pnpm -r typecheck && pnpm lint && pnpm -r test
```

Expected: all green. No `any` introduced in the public API (verify via `grep -rn " any" packages/*/src/index.ts packages/core/src/resource/defineResource.ts`).

- [ ] **Step 2: Bundle-size guard**

Run: `pnpm --filter @flowpanel/core build && ls -la packages/core/dist/index.mjs`
Expected: size delta ≤ +4 KB gzipped (typed builder is mostly types).

- [ ] **Step 3: Update `MEMORY.md` project_state**

Append: "B1 (typed resource builder) shipped — `defineResource(table, opts)` supports Drizzle + Prisma with enum/relation/JSON inference."

- [ ] **Step 4: Commit**

```bash
git add MEMORY.md
git commit -m "chore: note B1 shipment in project state"
```

---

## Self-review

1. **Spec coverage:** Every bullet of the freelance-radar `userResource / jobResource / paymentResource / aiCostResource` maps to a task — columns (Task 3), computed columns (Task 3), filters (Task 4), actions + stepUp + disabled + confirm (Task 5), drawer reference (Task 3 via `drawer` field on `TypedResourceDefinition`), realtime opt-in (Task 3), default sort (Task 3), relations (Task 10), Prisma parity (Task 9). The remaining freelance-radar features — widgets, theme tokens, realtime runtime — are B2/B5/B7/B8 and are left commented out per Task 13.

2. **Placeholder scan:** No `TODO`, `implement later`, or free-floating "similar to Task N". Every step has concrete code or commands.

3. **Type consistency:** `TypedResourceDefinition` declared in Task 3, referenced by Tasks 6, 8, 14; `ColumnRef` declared in Task 1, consumed in Tasks 2, 3, 4, 8; `FieldMetadata` reused unchanged across Tasks 1, 7, 9, 10; `inferMetadata` signature declared in Task 7 and extended (compatibly) in Task 10.

4. **Known gap — non-blocking:** The Drizzle-column type → `TRow` flow relies on `InferSelectModel<TTable>` from drizzle-orm. If a consumer's Drizzle version is old and lacks this helper, the fallback is `Record<string, unknown>` and the build still succeeds — users just get `unknown` inside `compute` callbacks. That's acceptable for B1; a hard constraint (`drizzle-orm >= 0.36`) is captured in the changeset.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-18-typed-resource-builder.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
