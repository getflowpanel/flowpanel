import { AUTH_PRESETS, type AuthProvider } from "../utils/auth-provider";
import { aliasOf, type PathAliasMode } from "../utils/detect";
import { validateProjectImport } from "../utils/module-path";

const SESSION_FILE = "server/lib/flowpanel-session.ts";

export interface AuthSessionPlan {
  provider: AuthProvider;
  /** Project-relative file the preset module is written to. */
  file: string;
  /** Import specifier the generated config uses for `getSession`. */
  specifier: string;
  template: string;
  vars: Record<string, string>;
}

export interface AuthSessionInput {
  cwd: string;
  provider: AuthProvider | null;
  /** What `detectAuth` found, already aliased. `null` when nothing matched. */
  detectedAuth: string | null;
  aliasMode: PathAliasMode;
  devAuth: boolean;
}

/**
 * A recognised provider whose auth module exports its instance rather than a
 * `getSession` is bridged through the matching preset instead of stopping the
 * install. A module that already exports `getSession` is left alone, and so is
 * `--dev-auth`.
 */
export async function planAuthSession(input: AuthSessionInput): Promise<AuthSessionPlan | null> {
  const { detectedAuth, provider } = input;
  if (!provider || input.devAuth) return null;
  const { instance } = AUTH_PRESETS[provider];
  // `validateProjectImport` answers with the problem, so no problem means the
  // module really does export that name.
  const exportsName = async (name: string): Promise<boolean> =>
    detectedAuth !== null && (await validateProjectImport(input.cwd, detectedAuth, name)) === null;

  if (await exportsName("getSession")) return null;
  if (instance !== null && !(await exportsName(instance))) return null;
  const file = input.aliasMode === "strip-src" ? `src/${SESSION_FILE}` : SESSION_FILE;
  return {
    provider,
    file,
    specifier: aliasOf(file, input.aliasMode),
    template: `auth-session.${provider}.ts.txt`,
    vars: instance === null ? {} : { AUTH_MODULE: detectedAuth as string },
  };
}
