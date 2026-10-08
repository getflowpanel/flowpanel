import { blockingSegmentExport } from "../utils/next-config";
import { tpl } from "../utils/template";
import { roleMapping } from "./init-auth";

export interface TemplateCall {
  template: string;
  vars: Record<string, string>;
}

export interface ConfigTemplateInput {
  orm: "drizzle" | "prisma";
  preset: boolean;
  db: string;
  schema: string;
  auth: string;
  appName: string;
  adminPath: string;
  apiPath: string;
  cli: string;
  provider: string;
  session: "stub" | "own";
}

export function configTemplateCall(input: ConfigTemplateInput): TemplateCall {
  return {
    template: `flowpanel.config.${input.orm}${input.preset ? ".preset" : ""}.ts.txt`,
    vars: {
      DB: input.db,
      SCHEMA: input.schema,
      AUTH: input.auth,
      APP_NAME: input.appName,
      ADMIN_PATH: input.adminPath,
      API_PATH: input.apiPath,
      CLI: input.cli,
      PROVIDER: input.provider,
      ROLE: roleMapping(input.session),
    },
  };
}

export function layoutTemplateCall(
  hostLayout: boolean,
  appName: string,
  cssImport: string,
  cacheComponents: boolean,
): TemplateCall {
  return {
    template: hostLayout ? "admin-layout.tsx.txt" : "app-layout.tsx.txt",
    vars: {
      APP_NAME: appName,
      CSS_IMPORT: cssImport,
      SEGMENT_CONFIG: blockingSegmentExport(cacheComponents),
    },
  };
}

export type ConfigImportTemplate =
  | "api-route.ts.txt"
  | "sse-route.ts.txt"
  | "admin-not-found.tsx.txt";

export function configImportTemplateCall(
  template: ConfigImportTemplate,
  configImport: string,
): TemplateCall {
  return { template, vars: { CONFIG_IMPORT: configImport } };
}

export function renderCall({ template, vars }: TemplateCall): Promise<string> {
  return tpl(template, vars);
}
