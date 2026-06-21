export interface AdminSession {
  id: number;
  email: string;
  role: "admin" | "support";
  // `user.id` is where FlowPanel looks for the audit actor id.
  user: { id: string; name: string };
}

/** Replace with your real auth (NextAuth, Clerk, Lucia, …). */
export async function getSession(_req: Request): Promise<AdminSession | null> {
  return {
    id: 1,
    email: "dev@localhost",
    role: "admin",
    user: { id: "alex.admin", name: "Alex Admin" },
  };
}
