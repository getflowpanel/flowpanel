export const MAX_WRITE_BODY_BYTES = 1024 * 1024;

export type RequestBodyError =
  | "payload-too-large"
  | "invalid-json"
  | "object-required"
  | "invalid-form";

export type RequestBodyResult<T> = { ok: true; value: T } | { ok: false; reason: RequestBodyError };

function declaredBodyIsTooLarge(req: Request): boolean {
  const raw = req.headers.get("content-length");
  if (raw === null) return false;
  const length = Number(raw);
  return Number.isFinite(length) && length > MAX_WRITE_BODY_BYTES;
}

async function readBody(req: Request): Promise<RequestBodyResult<ArrayBuffer>> {
  if (declaredBodyIsTooLarge(req)) {
    return { ok: false, reason: "payload-too-large" };
  }
  if (!req.body) return { ok: true, value: new ArrayBuffer(0) };

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_WRITE_BODY_BYTES) {
      await reader.cancel().catch(() => undefined);
      return { ok: false, reason: "payload-too-large" };
    }
    chunks.push(value);
  }

  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, value: body.buffer };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** Read a size-limited JSON request and require a plain object at the root. */
export async function readJsonObject(
  req: Request,
): Promise<RequestBodyResult<Record<string, unknown>>> {
  const body = await readBody(req);
  if (!body.ok) return body;
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(body.value));
  } catch {
    return { ok: false, reason: "invalid-json" };
  }
  if (!isPlainObject(value)) return { ok: false, reason: "object-required" };
  return { ok: true, value };
}

/** Read size-limited multipart or URL-encoded form data without consuming the request twice. */
export async function readRequestFormData(req: Request): Promise<RequestBodyResult<FormData>> {
  const body = await readBody(req);
  if (!body.ok) return body;
  const contentType = req.headers.get("content-type") ?? "";
  try {
    const value = await new Response(body.value, {
      headers: { "content-type": contentType },
    }).formData();
    return { ok: true, value };
  } catch {
    return { ok: false, reason: "invalid-form" };
  }
}

export function formDataObject(form: FormData): Record<string, unknown> {
  const value: Record<string, unknown> = {};
  for (const [key, field] of form.entries()) value[key] = field;
  return value;
}

/** Action bodies may be JSON, form data, or empty when an action has no fields. */
export async function readActionObject(
  req: Request,
): Promise<RequestBodyResult<Record<string, unknown>>> {
  const contentType = (req.headers.get("content-type") ?? "").toLowerCase();
  if (contentType.includes("application/json")) return readJsonObject(req);
  if (
    contentType.includes("multipart/form-data") ||
    contentType.includes("application/x-www-form-urlencoded")
  ) {
    const form = await readRequestFormData(req);
    return form.ok ? { ok: true, value: formDataObject(form.value) } : form;
  }
  const body = await readBody(req);
  return body.ok ? { ok: true, value: {} } : body;
}

export function requestBodyErrorResponse(reason: RequestBodyError): Response {
  if (reason === "payload-too-large") {
    return Response.json({ ok: false, error: "request body is too large" }, { status: 413 });
  }
  if (reason === "object-required") {
    return Response.json({ ok: false, error: "JSON body must be an object" }, { status: 400 });
  }
  if (reason === "invalid-form") {
    return Response.json({ ok: false, error: "invalid form data" }, { status: 400 });
  }
  return Response.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
}
