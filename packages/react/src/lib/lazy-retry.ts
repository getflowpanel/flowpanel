import { type ComponentType, type LazyExoticComponent, lazy } from "react";

/** `lazy` that loads once more after a short wait, as when a redeploy removed the chunk the page asked for. */
export function lazyRetry<P extends object>(
  load: () => Promise<{ default: ComponentType<P> }>,
): LazyExoticComponent<ComponentType<P>> {
  return lazy(() =>
    load().catch(() => new Promise<void>((resolve) => setTimeout(resolve, 800)).then(load)),
  );
}
