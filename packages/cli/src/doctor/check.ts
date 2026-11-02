import type { FileIntent } from "../plan/types";

export interface Check {
  name: string;
  ok: boolean;
  /** A passing check that still needs the developer's attention; it never counts as a failure. */
  warn?: boolean;
  /** A passing check with a suggestion; it never counts as a failure or a warning. */
  info?: boolean;
  hint?: string;
  /** If present, this check is auto-fixable. Returns the intended writes. */
  fix?: () => Promise<FileIntent[]>;
}
