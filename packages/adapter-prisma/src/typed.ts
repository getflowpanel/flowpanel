/**
 * Prisma half of the `defineResource(delegate, ...)` bridge.
 *
 * At `prismaAdapter({ prisma })` time we register a resolver that maps a
 * delegate object (e.g. `prisma.user`) to its `ModelMetadata` — the
 * identity of each delegate is stable for a given client instance, so a
 * WeakMap lookup is both accurate and cheap. Consumers call
 * `defineResource(prisma.user, { … })` and the core bridge delegates here.
 */

import type { ModelMetadata } from "@flowpanel/core";

export interface PrismaBridge {
  inferMetadata: (delegate: unknown) => ModelMetadata;
  /**
   * Registers delegates from a resolved DMMF model map. Called by
   * `prismaAdapter({ prisma })` once the client has been wrapped.
   */
  register: (prisma: Record<string, unknown>, models: Map<string, ModelMetadata>) => void;
}

const delegateToMetadata = new WeakMap<object, ModelMetadata>();

export const prismaBridge: PrismaBridge = {
  inferMetadata(delegate) {
    if (typeof delegate !== "object" || delegate === null) {
      throw new Error(
        "defineResource(prisma.X, …): expected a Prisma delegate object. " +
          "Got: " +
          typeof delegate,
      );
    }
    const meta = delegateToMetadata.get(delegate);
    if (!meta) {
      throw new Error(
        "defineResource: could not map this Prisma delegate to a model. " +
          "Make sure `prismaAdapter({ prisma })` runs before defineResource — " +
          "that's what registers delegates with the typed builder bridge.",
      );
    }
    return meta;
  },

  register(prisma, models) {
    for (const [modelName, metadata] of models) {
      const delegate = prisma[camelCase(modelName)] as object | undefined;
      if (delegate) delegateToMetadata.set(delegate, metadata);
    }
  },
};

function camelCase(name: string): string {
  if (!name) return name;
  return name.charAt(0).toLowerCase() + name.slice(1);
}
