// DEVELOPMENT STUB: every request is signed in as an admin. Replace getSession with your auth provider before deploying.
const WARNED = Symbol.for("flowpanel.devSessionWarned");

export async function getSession(): Promise<{ id: string; user: { id: string; role: string } }> {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[flowpanel] src/server/lib/auth.ts: the development session stub signs every request in as an admin, so it refuses to run in production. Replace getSession() there with your auth provider.",
    );
  }
  if (!Reflect.get(globalThis, WARNED)) {
    Reflect.set(globalThis, WARNED, true);
    console.warn(
      "[flowpanel] src/server/lib/auth.ts: signs every request in as an admin. Replace it before deploying.",
    );
  }
  return { id: "dev", user: { id: "dev", role: "admin" } };
}
