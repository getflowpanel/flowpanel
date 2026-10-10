// Return the signed-in session here, e.g. auth.api.getSession({ headers: await headers() }); until then the admin rejects every request.
type Session = { user: { id: string; role: string } };

export async function getSession(): Promise<Session | null> {
  return null;
}
