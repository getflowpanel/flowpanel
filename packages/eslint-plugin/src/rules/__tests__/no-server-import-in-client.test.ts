import rule from "../no-server-import-in-client.js";
import { ruleTester } from "./setup.js";

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
  ],
});
