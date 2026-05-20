/**
 * Parses a drawer action request body. Drawer actions may submit via `<Form>`
 * (form-data), programmatic fetch with JSON, or no body (click-to-run buttons).
 * Malformed or empty bodies are treated as no input.
 */
export async function parseActionBody(req: Request): Promise<Record<string, unknown>> {
  let input: Record<string, unknown> = {};
  const contentType = req.headers.get("content-type") ?? "";
  if (
    contentType.includes("multipart/form-data") ||
    contentType.includes("application/x-www-form-urlencoded")
  ) {
    try {
      const fd = await req.formData();
      for (const [k, v] of fd.entries()) {
        input[k] = v;
      }
    } catch {
      // empty / malformed body — treat as no input
    }
  } else if (contentType.includes("application/json")) {
    try {
      input = (await req.json()) as Record<string, unknown>;
    } catch {
      // empty / malformed body — treat as no input
    }
  }
  return input;
}
