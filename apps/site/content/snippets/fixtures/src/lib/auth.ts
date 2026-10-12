export interface AppSession {
  session: { id: string; userId: string; expiresAt: Date };
  user: {
    id: string;
    email: string;
    name: string;
    image: string | null;
    role: string;
    tenantId: string;
    orgId: string;
  };
}

export declare const auth: {
  api: { getSession(args: { headers: Headers }): Promise<AppSession | null> };
  $Infer: { Session: AppSession };
};

export async function getSession(request?: Request): Promise<typeof auth.$Infer.Session | null> {
  return auth.api.getSession({ headers: request?.headers ?? new Headers() });
}
