import cliReference from "../../generated/cli-reference.json";

export interface CliArgumentDoc {
  syntax: string;
  description: string;
  required: boolean;
  variadic: boolean;
  defaultValue?: string;
}

export interface CliOptionDoc {
  flags: string;
  description: string;
  value: "none" | "required" | "optional";
  mandatory: boolean;
  negated: boolean;
  defaultValue?: string;
}

export interface CliCommandDoc {
  name: string;
  usage: string;
  description: string;
  arguments: readonly CliArgumentDoc[];
  options: readonly CliOptionDoc[];
}

export function readCliReference(): CliCommandDoc[] {
  return cliReference as CliCommandDoc[];
}
