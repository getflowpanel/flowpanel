import { resolveDemoRole } from "./role";

export interface AdminSession {
  id: number;
  email: string;
  role: "admin" | "support";
  user: { id: string; name: string };
}

/**
 * Synthetic identities for the demo persona switch. A real application
 * replaces this entire `src/demo/auth` module with its trusted auth provider.
 */
export async function getDemoSession(req: Request): Promise<AdminSession> {
  const role = resolveDemoRole(req.headers.get("cookie"));
  return {
    id: 1,
    email: "dev@localhost",
    role,
    user:
      role === "admin"
        ? { id: "alex.admin", name: "Alex Admin" }
        : { id: "sam.support", name: "Sam Support" },
  };
}
