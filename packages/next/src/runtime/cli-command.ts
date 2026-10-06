const RUNNERS = new Map([
  ["pnpm", "pnpm"],
  ["yarn", "yarn"],
  ["bun", "bunx"],
  ["npm", "npx"],
]);

/** The flowpanel CLI command as the package manager that started this server runs it; bare when that is unknown. */
export function cliCommand(args: string): string {
  const manager = (process.env.npm_config_user_agent ?? "").split("/")[0] ?? "";
  const runner = RUNNERS.get(manager);
  return runner ? `${runner} flowpanel ${args}` : `flowpanel ${args}`;
}
