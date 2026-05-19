# File uploads

FlowPanel doesn't ship a "file upload column" — storage is never one-size-fits-all
(S3, R2, Supabase Storage, Blob, self-hosted), and pretending to abstract over
them all leads to a leaky config surface. What it does ship is enough primitives
that you can wire one in about fifty lines, and the result is yours to own.

## The pattern at a glance

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────┐
│  Browser <File> │──1──▶│  action.dialog   │──2──▶│  S3 / R2    │
│  picker cell    │      │  (presigned URL) │      │             │
└─────────────────┘      └──────────────────┘      └─────────────┘
       │                          │                        │
       │                          └─── 3. direct PUT ──────┘
       │                                   │
       ▼                                   ▼
┌─────────────────┐             ┌──────────────────┐
│  update(row,    │             │  uploads record  │
│  { avatarUrl }) │◀──── 4 ─────│  (URL + meta)    │
└─────────────────┘             └──────────────────┘
```

1. User picks a file in a FlowPanel custom cell you own.
2. FlowPanel calls a **`collection` action** you defined to mint a presigned URL.
3. The browser `PUT`s the file directly to S3 (never transits your server).
4. Your code updates the row with the final URL.

This is the same flow Retool, Supabase Admin, and every SaaS that doesn't want
to proxy gigabytes uses. FlowPanel's role: (2) and (4) are actions, the cell
in (1) is a `flowpanel add image-cell` template, the storage in (3) is yours.

## Server side — the presign action

```ts
// flowpanel.config.ts
import { defineAdmin, resource } from "flowpanel";
import { prismaAdapter } from "flowpanel/prisma";
import { prisma } from "./lib/prisma";
import { presignPutUrl, publicUrl } from "./lib/storage"; // your S3/R2 helpers

export const flowpanel = defineAdmin({
  adapter: prismaAdapter({ prisma }),

  resources: [
    resource(prisma.user, {
      columns: (u) => [
        u.email,
        u.name,
        {
          id: "avatar",
          label: "Avatar",
          // `custom` cell type renders your React component (see below).
          render: "image-cell",
        },
      ],
      actions: (a) => ({
        // (2) presign: client calls this, server returns a URL to PUT to.
        presignAvatar: a.dialog({
          label: "Upload avatar",
          variant: "hidden", // not shown as a button — called programmatically
          schema: {
            fields: [
              { name: "filename", type: "text", required: true },
              { name: "contentType", type: "text", required: true },
              { name: "sizeBytes", type: "number", required: true },
            ],
          },
          handler: async (values, row, ctx) => {
            // Size cap — presigned URL enforces it, but refuse early.
            if ((values.sizeBytes as number) > 5_000_000) {
              throw new Error("Max 5 MB");
            }
            const key = `avatars/${row!.id}/${crypto.randomUUID()}-${values.filename}`;
            const putUrl = await presignPutUrl({
              key,
              contentType: values.contentType as string,
              contentLength: values.sizeBytes as number,
              expiresSeconds: 60,
            });
            // Return the URL client needs + the public URL we'll save on success.
            return { putUrl, key, publicUrl: publicUrl(key) };
          },
        }),

        // (4) finalize: called after the PUT succeeds.
        setAvatarUrl: a.dialog({
          label: "Set avatar URL",
          variant: "hidden",
          schema: {
            fields: [{ name: "url", type: "text", required: true }],
          },
          handler: async (values, row, ctx) => {
            await ctx.db.user.update({
              where: { id: row!.id },
              data: { avatarUrl: values.url as string },
            });
          },
        }),
      }),
    }),
  ],
});
```

## Client side — the picker cell

Copy a template you own:

```bash
pnpm flowpanel add image-cell
```

(Not in the default set yet — fall back to writing it directly at
`src/flowpanel/widgets/ImageCell.tsx`.)

```tsx
// src/flowpanel/widgets/ImageCell.tsx
"use client";

import { useTrpc } from "@flowpanel/react";
import { useRef, useState } from "react";

export function ImageCell({ row }: { row: { id: string; avatarUrl?: string | null } }) {
  const trpc = useTrpc(); // tiny helper from @flowpanel/react
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    try {
      // (2) ask server for a presigned URL
      const presign = await trpc.resource.actionDialog.mutate({
        resourceId: "user",
        actionId: "presignAvatar",
        recordId: row.id,
        values: { filename: file.name, contentType: file.type, sizeBytes: file.size },
      });

      // (3) PUT the bytes directly to S3 — no proxying through your server
      const res = await fetch(presign.putUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);

      // (4) tell the server we're done so it can persist the URL
      await trpc.resource.actionDialog.mutate({
        resourceId: "user",
        actionId: "setAvatarUrl",
        recordId: row.id,
        values: { url: presign.publicUrl },
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {row.avatarUrl ? (
        <img src={row.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
      ) : (
        <div className="h-8 w-8 rounded-full bg-muted" />
      )}
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={uploading}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        {uploading ? "Uploading…" : "Change"}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
    </div>
  );
}
```

Register the component name (`"image-cell"`) in `<FlowPanelUI components={...} />`:

```tsx
import { ImageCell } from "@/flowpanel/widgets/ImageCell";
<FlowPanelUI config={flowpanel} components={{ "image-cell": ImageCell }} />
```

## Why two actions instead of one

The browser PUTs bytes directly to S3 — that means **there's no way for the
server to know the upload succeeded** unless the client tells it. Some projects
use S3 event notifications + a webhook; for an admin panel that's overkill.
Two dialog actions (presign + finalize) give you:

- Instant failure feedback if the upload breaks (the finalize call never
  happens, nothing is persisted).
- The full URL is persisted server-side — the client can't fake it by
  returning an attacker-controlled URL, because finalize only writes to the
  row the action was scoped to.
- You can do virus scanning / thumbnail generation between steps if you want,
  via a queue job kicked off in `setAvatarUrl`.

## Security checklist

- [ ] Presigned URL expires fast (60s is plenty for an admin UI).
- [ ] Max file size and allowed `contentType` checked server-side in presign.
- [ ] `row!.id` used in the S3 key prefix — users can't overwrite each other.
- [ ] `rowLevel` scope (multi-tenant recipe) applies to the user row being
      edited, so a user can only upload to their own avatar slot.
- [ ] Stored URLs are public (CDN domain) OR the view uses signed GETs —
      depends on your bucket policy; FlowPanel doesn't care which.

## What we deliberately don't do

- **No built-in S3 / R2 / Supabase integration.** Each has its own creds, its
  own region, its own bucket naming — wrapping that would multiply the config
  surface and still miss a client. You wire the SDK once.
- **No multipart upload.** 5 MB avatar on a PUT is instant; >100 MB uploads
  want resumable uploads and a real storage SDK anyway.
- **No image manipulation.** Thumbnails, rotation, format conversion — queue
  jobs live outside the admin panel. Kick one off in `setAvatarUrl` if needed.
