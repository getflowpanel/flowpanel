import rule from "../no-server-import-in-client";
import { ruleTester } from "./setup";

ruleTester().run("no-server-import-in-client", rule, {
  valid: [
    {
      name: "no use-client directive, importing db is fine",
      code: `
        import { db } from "@/db";
        export const x = 1;
      `,
    },
    {
      name: "use-client file imports a regular module",
      code: `
        "use client";
        import { useState } from "react";
        export const x = 1;
      `,
    },
    {
      name: "use-client file imports a normal third-party package",
      code: `
        "use client";
        import lodash from "lodash";
        export const x = 1;
      `,
    },
    {
      name: "use-client file imports a path that happens to contain 'server' as a substring of another word",
      code: `
        "use client";
        import { x } from "@/observer/x";
        export const x2 = 1;
      `,
    },
    {
      name: "next/server is a package entry point, not an app server module",
      code: `
        "use client";
        import { NextResponse } from "next/server";
        export const x = 1;
      `,
    },
    {
      name: "type-only import of a server module is erased before bundling",
      code: `
        "use client";
        import type { Db } from "@/db";
        export const x: Db | null = null;
      `,
    },
    {
      name: "type-only import from an app server path",
      code: `
        "use client";
        import type { Handler } from "@/lib/server/auth";
        export const x: Handler | null = null;
      `,
    },
  ],
  invalid: [
    {
      name: "use-client + @/db import",
      code: `
        "use client";
        import { db } from "@/db";
        export const x = 1;
      `,
      errors: [{ messageId: "serverImport", data: { source: "@/db" } }],
    },
    {
      name: "use-client + server-only sentinel",
      code: `
        "use client";
        import "server-only";
        export const x = 1;
      `,
      errors: [{ messageId: "serverImport", data: { source: "server-only" } }],
    },
    {
      name: "use-client + /server/ segment in path",
      code: `
        "use client";
        import { handler } from "@/lib/server/auth";
        export const x = 1;
      `,
      errors: [{ messageId: "serverImport", data: { source: "@/lib/server/auth" } }],
    },
    {
      name: "use-client + nested @/db/*",
      code: `
        "use client";
        import { users } from "@/db/schema";
        export const x = 1;
      `,
      errors: [{ messageId: "serverImport", data: { source: "@/db/schema" } }],
    },
    {
      name: "use-client + a bare package's /server subpath export",
      code: `
        "use client";
        import { createHandler } from "@flowpanel/kit/server";
        export const x = 1;
      `,
      errors: [{ messageId: "serverImport", data: { source: "@flowpanel/kit/server" } }],
    },
    {
      name: "use-client + a nested /server/ segment inside a bare package",
      code: `
        "use client";
        import { auth } from "some-pkg/server/auth";
        export const x = 1;
      `,
      errors: [{ messageId: "serverImport", data: { source: "some-pkg/server/auth" } }],
    },
  ],
});
