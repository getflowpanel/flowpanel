import { lazy } from "react";

// One more try after a short wait, as when a redeploy removed the chunk the page asked for.
export const ChartBody = lazy(() =>
  import("./chart-body").catch(() =>
    new Promise<void>((resolve) => setTimeout(resolve, 800)).then(() => import("./chart-body")),
  ),
);
