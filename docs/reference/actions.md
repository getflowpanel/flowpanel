# Actions

Actions are the primary DX surface for custom behavior in an admin. FlowPanel supports **five kinds**, each with a clear place in a resource workflow.

| Kind | Where it renders | Signature |
|---|---|---|
| `a.mutation` | per-row in the detail drawer | `(row, ctx) => Promise` |
| `a.bulk` | sticky bar when rows are selected | `(rows, ctx) => Promise` |
| `a.collection` | toolbar, no row context | `(ctx) => Promise` |
| `a.link` | per-row or toolbar as an anchor | `(row) => url` |
| `a.dialog` | opens a form, then calls handler | `(values, row?, ctx) => Promise` |

## Defining actions

```ts
resource(prisma.user, {
  actions: (a) => ({
    // per-row mutation with confirm
    archive: a.mutation({
      label: "Archive",
      variant: "danger",
      confirm: {
        title: "Archive user?",
        description: "The user will be signed out of all sessions.",
        typeToConfirm: "ARCHIVE",       // optional: type-to-confirm for destructive ops
      },
      when: (row) => !row.archivedAt,   // hides button when already archived
      handler: async (row, ctx) => {
        await ctx.db.user.update({
          where: { id: row.id },
          data: { archivedAt: new Date() },
        });
      },
      onSuccess: { toast: "User archived" },
    }),

    // bulk action on selected rows
    archiveMany: a.bulk({
      label: "Archive selected",
      variant: "danger",
      confirm: "Archive all selected users?",
      handler: async (rows, ctx) => {
        await ctx.db.user.updateMany({
          where: { id: { in: rows.map((r) => r.id) } },
          data: { archivedAt: new Date() },
        });
      },
    }),

    // collection — no row context
    exportCsv: a.collection({
      label: "Export CSV",
      handler: async (ctx) => {
        const users = await ctx.db.user.findMany();
        return {
          download: {
            filename: "users.csv",
            content: toCsv(users),
            mimeType: "text/csv",
          },
        };
      },
    }),

    // link — static template with row-field substitution
    viewInStripe: a.link({
      label: "View in Stripe",
      href: "https://dashboard.stripe.com/customers/{stripeCustomerId}",
      external: true,
    }),

    // dialog — form → handler
    sendEmail: a.dialog({
      label: "Send email",
      schema: {
        title: "Send email",
        fields: [
          { name: "subject", type: "text", required: true },
          { name: "body", type: "textarea", required: true },
          { name: "priority", type: "select", options: ["low", "normal", "high"] },
        ],
      },
      handler: async (values, row, ctx) => {
        await sendEmail(row!.email, values.subject, values.body, values.priority);
      },
      onSuccess: { toast: "Email queued" },
    }),
  }),
});
```

## Confirm config

Any action (except `a.link`) accepts `confirm`:

```ts
confirm: "Are you sure?"                        // string → title
confirm: {
  title: "Delete user?",
  description: "This is permanent.",
  intent: "destructive",                        // adds warning icon
  typeToConfirm: "my-email@example.com",        // require exact match
  confirmLabel: "Yes, delete",
}
```

`typeToConfirm` is the common 10/10 pattern — the confirm button stays disabled until the user types the exact string. Use it for delete operations on high-value resources.

## Downloads

Bulk, collection, and dialog actions can return a `download` payload:

```ts
handler: async (rows, ctx) => ({
  download: {
    filename: "report.json",
    content: JSON.stringify(rows, null, 2),
    mimeType: "application/json",
  },
}),
```

The client automatically triggers a file download when a handler responds with `download`.

## onSuccess

```ts
onSuccess: {
  toast: "User archived",            // custom toast message
  invalidate: ["users", "audit"],    // (hooks reserved for future cache integration)
}
```

By default, FlowPanel shows `{label} succeeded` on success and `{label} failed` with the error message on failure — both via sonner toasts.

## Access

Action IDs double as access keys:

```ts
access: {
  archive: ["admin"],           // only admins see the Archive button
  exportCsv: () => isBusiness,  // dynamic predicate
}
```

When an action is not allowed, its button is simply not rendered — no 403 needed.
