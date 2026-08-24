/** Public mount points for the generated admin UI and HTTP API. */
export interface AdminPaths {
  admin: string;
  api: string;
}

export type AdminPathsInput = Partial<AdminPaths>;
