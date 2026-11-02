/** A config problem in the format core reports one: `[flowpanel] <where in the config>: <what is wrong>. <how to fix>.` */
export function configProblem(where: string, problem: string): string {
  return `[flowpanel] ${where}: ${problem}`;
}

export function noConfigMessage(cwd: string, dlx: string): string {
  return configProblem(
    "flowpanel.config.ts",
    `not found in ${cwd}. Run \`${dlx} @flowpanel/cli init\` first.`,
  );
}
