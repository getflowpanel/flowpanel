import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// A config that reaches every subpath a config graph can import, loaded by a `.ts` script in a CommonJS project.
const CONFIG = `import { defineAdmin, resource } from "@flowpanel/kit";
import { withBetterAuth } from "@flowpanel/kit/auth";
import { bullmqAdapter } from "@flowpanel/kit/bullmq";
import { AreaChart } from "@flowpanel/kit/charts";
import { clientMetadata } from "@flowpanel/kit/client";
import { drizzleAdapter } from "@flowpanel/kit/drizzle";
import { prismaAdapter } from "@flowpanel/kit/prisma";
import { createPublisher } from "@flowpanel/kit/publish";
import { DefaultButton } from "@flowpanel/kit/react";
import { smokeAdmin } from "@flowpanel/kit/test";
import { pgTable, serial, text } from "drizzle-orm/pg-core";

const orders = pgTable("orders", { id: serial("id").primaryKey(), status: text("status") });
const auth = withBetterAuth({ auth: { api: { getSession: async () => null } } });
const prisma = prismaAdapter({
  prisma: {},
  provider: "postgresql",
  dmmf: { datamodel: { models: [{ name: "Order", fields: [] }], enums: [] } },
});

export const loaded = {
  queues: bullmqAdapter({}).kind,
  chart: typeof AreaChart,
  client: typeof clientMetadata,
  prisma: prisma.kind,
  publish: typeof createPublisher,
  react: typeof DefaultButton,
  test: typeof smokeAdmin,
  auth: typeof auth.session,
};

export default defineAdmin({
  adapter: drizzleAdapter({ db: {}, schema: { orders } }),
  auth: { session: async () => null, role: () => "guest", access: "admin" },
  resources: [resource(orders, { columns: ["id", "status"] })],
  paths: { api: "/api/ops" },
});
`;

const SCRIPT = `import { clientMetadata, createFlowpanelClient } from "@flowpanel/kit/client";
import admin, { loaded } from "./admin.config";

const seen: string[] = [];
const client = createFlowpanelClient(clientMetadata(admin), {
  baseUrl: "http://localhost:3000",
  headers: { cookie: "session=1" },
  fetch: async (url, init) => {
    seen.push(String(url), new Headers(init?.headers).get("cookie") ?? "");
    const data = { rows: [], total: 0, page: 1, pageSize: 20 };
    return Response.json({ ok: true, data, meta: { requestId: "r1" } });
  },
});
client.resource("orders").list().then((result) => {
  console.log(JSON.stringify({ ok: result.ok, seen, loaded }));
  process.exit(0);
});
`;

/** A `.ts` script under tsx in a project without `"type": "module"` imports the config and calls the API. */
export async function checkCommonJsScript(full) {
  const scripts = path.join(full, "cjs-scripts");
  await mkdir(scripts);
  await writeFile(path.join(scripts, "package.json"), JSON.stringify({ private: true }));
  await writeFile(path.join(scripts, "admin.config.ts"), CONFIG);
  await writeFile(path.join(scripts, "orders.ts"), SCRIPT);
  const tsx = path.join(full, "node_modules/tsx/dist/cli.mjs");
  const output = execFileSync(process.execPath, [tsx, "orders.ts"], {
    cwd: scripts,
    encoding: "utf8",
    timeout: 120_000,
  });
  const listed = JSON.parse(output.trim());
  assert.deepEqual(
    listed,
    {
      ok: true,
      seen: ["http://localhost:3000/api/ops/orders", "session=1"],
      loaded: {
        queues: "bullmq",
        chart: "function",
        client: "function",
        prisma: "prisma",
        publish: "function",
        react: "object",
        test: "function",
        auth: "function",
      },
    },
    "a CommonJS tsx script could not load a config that imports every kit subpath",
  );
  console.log(
    "  tsx script in a CommonJS project: a config importing every subpath loads and lists",
  );
}
