import type { Session } from "@flowpanel/kit";

export async function getSession(): Promise<Session | null> {
  return { user: { role: "admin" } };
}
