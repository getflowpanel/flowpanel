/**
 * Resource tRPC procedures — thin composer.
 *
 * The actual work lives in three focused files:
 *   - `./resource/crud.ts`    — list, get, create, update, delete
 *   - `./resource/actions.ts` — action, actionBulk, actionCollection, actionDialog
 *   - `./resource/helpers.ts` — access, row-level security, filters, publishing
 *
 * Adding a new operation? Pick the right file; this module just glues the
 * procedure maps into a single router.
 */

import { z } from "zod";
import { serializeResource } from "../../resource/serializer";
import type { Session } from "../../types/config";
import type { FlowPanelContext } from "../context";
import { createActionProcedures } from "./resource/actions";
import { createCrudProcedures } from "./resource/crud";
import { getSessionRoles } from "./resource/helpers";

export function createResourceProcedures(
  // biome-ignore lint/suspicious/noExplicitAny: tRPC internal builder type
  t: { procedure: any; router: (routes: any) => any },
  // biome-ignore lint/suspicious/noExplicitAny: tRPC internal builder type
  authedProcedure: any,
) {
  return t.router({
    ...createCrudProcedures(authedProcedure),
    ...createActionProcedures(authedProcedure),

    /**
     * `schema` returns the full client-facing snapshot of every resource
     * the caller is allowed to see. The React shell hits this once on boot
     * to build the sidebar / tables / drawers.
     */
    schema: authedProcedure
      .input(z.object({}).optional())
      .query(async ({ ctx }: { ctx: FlowPanelContext & { session: Session } }) => {
        if (!ctx.resources) {
          return { resources: {} };
        }

        const roles = getSessionRoles(ctx.session);
        const serialized: Record<string, ReturnType<typeof serializeResource>> = {};

        for (const [key, resource] of Object.entries(ctx.resources)) {
          serialized[key] = serializeResource(resource, roles);
        }

        return { resources: serialized };
      }),
  });
}
