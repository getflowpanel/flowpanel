/**
 * Structured payload handed to the user-provided `config.audit` callback
 * after every mutation procedure.
 *
 * Keep this type stable — it's part of the public contract once 1.0 ships.
 */

export interface AuditActor {
  id?: string | number;
  email?: string;
  role?: string;
}

export interface AuditEvent {
  /** Procedure path — e.g. "resource.userMutation" or "runs.retry". */
  path: string;
  /** High-level kind derived from path: "mutation" for any write, "query" otherwise. */
  kind: "mutation" | "query";
  /** Whether the procedure succeeded. */
  ok: boolean;
  /** Error message if ok === false. */
  error?: string;
  /** Authenticated user (null when session is absent). */
  actor: AuditActor | null;
  /** Client IP if forwarded by the proxy. */
  ip?: string;
  /** User agent header. */
  userAgent?: string;
  /** X-Request-Id header if present — ties into your trace. */
  requestId?: string;
  /** Wall-clock timestamp when the event was emitted. */
  at: Date;
}
