import type { ResolvedLabels } from "../../types/labels";
import { ES_CHROME } from "./chrome";
import { ES_MESSAGES } from "./messages";

/** Complete Spanish chrome preset; plain strings safe to pass through RSC. */
export const ES_LABELS: ResolvedLabels = /* @__PURE__ */ Object.assign({}, ES_CHROME, ES_MESSAGES);
