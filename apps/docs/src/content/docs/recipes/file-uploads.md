---
title: 'File uploads'
description: 'WIP — a first-class file column type with a presigned-URL handler contract is on the roadmap for v1.1.'
---


> **WIP — planned for v1.1.** A first-class `file` column type with a
> presigned-URL handler contract is on the roadmap (see `ROADMAP.md` §1.4,
> item 2). It is **not shipped yet** — the field types `"file"` and
> `"image"` exist in the `FieldType` union
> (`packages/core/src/types/resource.ts`) but are not wired through the
> form renderer, and there is no built-in presigned URL action shape.
> Earlier drafts of this page described an API (`a.dialog(...)`, named
> cell renderers like `render: "image-cell"`,
> `<FlowPanelUI components={{ ... }} />`, `useTrpc()`) that does not
> exist in the current codebase. They have been removed rather than left
> as a trap.

## What works today

If you need uploads before v1.1 ships, treat the storage flow as
application code, not admin config:

1. Store a plain string column on the resource (e.g. `avatarUrl: text`)
   and list it as a normal column.
2. Handle the upload in your own Next.js route or Server Action, outside
   FlowPanel — your handler signs the URL, the browser PUTs to S3/R2/etc,
   then your handler updates the row.
3. Surface a button on the row through the regular `actions` array
   (`RowAction<Row>` in `packages/core/src/types/action.ts`) — but the
   `run` handler only exchanges JSON, it cannot stream a file. For a
   richer picker UI you would `eject` the resource (see README) and
   write the upload UI yourself.

This is intentionally minimal. A full recipe lands once the column type
ships in v1.1.
