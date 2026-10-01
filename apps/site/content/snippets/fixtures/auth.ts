export async function getSession(): Promise<{ user: { role: string } } | null> {
  return { user: { role: "admin" } };
}
