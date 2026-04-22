export interface AdminSession {
  id: number;
  email: string;
  role: "admin" | "support";
}

/** Replace with your real auth (NextAuth, Clerk, Lucia, …). */
export async function getSession(_req: Request): Promise<AdminSession | null> {
  return { id: 1, email: "dev@localhost", role: "admin" };
}
