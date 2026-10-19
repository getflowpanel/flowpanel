import {
  type ComponentType,
  createElement,
  type LazyExoticComponent,
  lazy,
  type ReactNode,
} from "react";

let attempt = 0;

/** A part's code that did not arrive, told apart from an error the part throws while rendering. */
export class ChunkLoadError extends Error {
  override name = "ChunkLoadError";
}

/** Lets every part whose code failed to load ask for it again on its next render, as an error boundary's Retry does. */
export function retryFailedParts(): void {
  attempt += 1;
}

/** Loads a component on first render, retrying once; a failure reaches the error boundary, whose Retry loads again. */
export function lazyRetry<P extends object>(
  load: () => Promise<{ default: ComponentType<P> }>,
): (props: P) => ReactNode {
  let failedAt: number | null = null;
  const fresh = (): LazyExoticComponent<ComponentType<P>> =>
    lazy(() =>
      load()
        .catch(() => new Promise<void>((resolve) => setTimeout(resolve, 800)).then(load))
        .catch((error: unknown) => {
          failedAt = attempt;
          throw new ChunkLoadError("A part of the page could not be loaded.", { cause: error });
        }),
    );
  let current = fresh();
  return function Lazy(props: P) {
    if (failedAt !== null && failedAt !== attempt) {
      failedAt = null;
      current = fresh();
    }
    return createElement(current, props);
  };
}
