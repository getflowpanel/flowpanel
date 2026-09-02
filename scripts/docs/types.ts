export type PublicSymbolKind =
  | "class"
  | "const"
  | "enum"
  | "function"
  | "interface"
  | "type"
  | "unknown";

export interface PublicSymbol {
  packageName: string;
  exportPath: string;
  exportName: string;
  kind: PublicSymbolKind;
  declarationPath: string;
  declarationName: string;
  isTypeOnly: boolean;
}

export interface DocsProblem {
  code: string;
  file: string;
  line: number;
  message: string;
  suggestion?: string;
}
