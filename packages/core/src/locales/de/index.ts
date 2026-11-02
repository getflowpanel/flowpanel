import type { ResolvedLabels } from "../../types/labels";
import { DE_CHROME } from "./chrome";
import { DE_MESSAGES } from "./messages";

/** Complete German chrome preset; plain strings safe to pass through RSC. */
export const DE_LABELS: ResolvedLabels = /* @__PURE__ */ Object.assign({}, DE_CHROME, DE_MESSAGES);
