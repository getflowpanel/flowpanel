import type { ResolvedLabels } from "../../types/labels";
import { FR_CHROME } from "./chrome";
import { FR_MESSAGES } from "./messages";

/** Complete French chrome preset; plain strings safe to pass through RSC. */
export const FR_LABELS: ResolvedLabels = /* @__PURE__ */ Object.assign({}, FR_CHROME, FR_MESSAGES);
