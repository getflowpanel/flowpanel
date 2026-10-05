import { findSessionModule } from "../doctor/session-module";
import { createFilesystemPlan } from "../plan/filesystem-plan";
import type { FilesystemPlan } from "../plan/types";
import { devSessionStub } from "./init-auth";
import { customisedSessionMessage, DEV_AUTH_IN_CONFIG } from "./init-output";

export type DevAuthOnProject =
  | { kind: "plan"; file: string; plan: FilesystemPlan }
  | { kind: "refuse"; message: string };

/**
 * `init --dev-auth` once flowpanel.config.ts exists. The config and the files `new` edits are the
 * developer's now, so only the session module the config imports is looked at, and only one of
 * init's own stubs is replaced.
 */
export async function planDevAuthOnProject(cwd: string): Promise<DevAuthOnProject> {
  const session = await findSessionModule(cwd);
  if (session === null) {
    return {
      kind: "refuse",
      message: `Nothing was written. flowpanel.config.ts imports no getSession, so --dev-auth has nothing to replace. To open the admin while you develop, ${DEV_AUTH_IN_CONFIG}.`,
    };
  }
  if (session.kind === "custom") {
    return { kind: "refuse", message: customisedSessionMessage(session.file, true) };
  }
  const plan = await createFilesystemPlan(cwd, [
    { path: session.file, content: await devSessionStub(session.file), overwrite: true },
  ]);
  return { kind: "plan", file: session.file, plan };
}
