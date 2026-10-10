"use server";

export async function archiveOrder(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return id ? { ok: true } : { ok: false, error: "Missing order" };
}
