import type { ResolvedLabels } from "../../types/labels";
import { PT_BR_CHROME } from "./chrome";
import { PT_BR_MESSAGES } from "./messages";

/** Complete Brazilian Portuguese chrome preset; plain strings safe to pass through RSC. */
export const PT_BR_LABELS: ResolvedLabels = /* @__PURE__ */ Object.assign(
  {},
  PT_BR_CHROME,
  PT_BR_MESSAGES,
);
