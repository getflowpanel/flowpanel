import { readSandboxConfig } from "../sandbox/config";
import {
  DEMO_FINGERPRINT_HEADER,
  DEMO_SANDBOX_HEADER,
  isPublicSandboxId,
} from "../sandbox/identity";
import { resolveDemoRole } from "./role";

export type AdminSession = {
  id: number;
  email: string;
  role: "admin" | "support";
  sandboxId: string;
  user: { id: string; name: string };
};

/**
 * Synthetic identities for the demo persona switch. A real application
 * replaces this entire `src/demo/auth` module with its trusted auth provider.
 */
export async function getDemoSession(req: Request): Promise<AdminSession> {
  const config = readSandboxConfig();
  const sandboxId = req.headers.get(DEMO_SANDBOX_HEADER);
  const validSandbox = config.publicMode ? isPublicSandboxId(sandboxId) : sandboxId === "local";
  if (!validSandbox || !sandboxId) {
    throw new Error("A valid proxy-bound demo sandbox identity is required");
  }
  const fingerprint = req.headers.get(DEMO_FINGERPRINT_HEADER);
  if (config.publicMode && !/^[a-f0-9]{64}$/.test(fingerprint ?? "")) {
    throw new Error("A valid proxy-bound demo fingerprint is required");
  }
  const role = resolveDemoRole(req.headers.get("cookie"));
  return {
    id: 1,
    email: "dev@localhost",
    role,
    sandboxId,
    user:
      role === "admin"
        ? { id: "alex.admin", name: "Alex Admin" }
        : { id: "sam.support", name: "Sam Support" },
  };
}
