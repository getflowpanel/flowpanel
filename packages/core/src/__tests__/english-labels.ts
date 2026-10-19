import { SERVER_LABELS } from "../internal";
import { DEFAULT_LABELS } from "../types/labels";

/** Every English string a preset translates: the browser's `DEFAULT_LABELS` and the server's own. */
export const ENGLISH_LABELS = {
  ...DEFAULT_LABELS,
  form: { ...DEFAULT_LABELS.form, ...SERVER_LABELS.form },
  fields: SERVER_LABELS.fields,
};
