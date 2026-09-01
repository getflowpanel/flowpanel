export interface MigrationSqlTokenizeOptions {
  dollarQuotes?: boolean;
  mysqlComments?: boolean;
}

export interface MigrationSqlStatement {
  text: string;
  syntax: string;
  hasDollarQuote: boolean;
  hasExecutableMysqlComment: boolean;
}

export type MigrationSqlLexErrorReason = "unterminated-quote-or-comment";

export class MigrationSqlLexError extends Error {
  readonly reason: MigrationSqlLexErrorReason;

  constructor(reason: MigrationSqlLexErrorReason) {
    super(reason);
    this.name = "MigrationSqlLexError";
    this.reason = reason;
  }
}

export function tokenizeMigrationSql(
  rawSql: string,
  options: MigrationSqlTokenizeOptions = {},
): MigrationSqlStatement[] {
  const statements: MigrationSqlStatement[] = [];
  let start = 0;
  let quote: "'" | '"' | "`" | "]" | null = null;
  let dollarQuote: string | null = null;
  let lineComment = false;
  let blockDepth = 0;
  let hasCode = false;
  let hasDollarQuote = false;
  let hasExecutableMysqlComment = false;
  let syntax = "";

  const finishStatement = (end: number) => {
    if (hasCode) {
      statements.push({
        text: rawSql.slice(start, end).trim(),
        syntax: syntax.trim(),
        hasDollarQuote,
        hasExecutableMysqlComment,
      });
    }
    start = end + 1;
    hasCode = false;
    hasDollarQuote = false;
    hasExecutableMysqlComment = false;
    syntax = "";
  };

  for (let index = 0; index < rawSql.length; index++) {
    const char = rawSql[index];
    const next = rawSql[index + 1];

    if (lineComment) {
      if (char === "\n") {
        lineComment = false;
        syntax += " ";
      }
      continue;
    }
    if (blockDepth > 0) {
      if (char === "/" && next === "*") {
        blockDepth++;
        index++;
      } else if (char === "*" && next === "/") {
        blockDepth--;
        index++;
      }
      continue;
    }
    if (dollarQuote) {
      if (rawSql.startsWith(dollarQuote, index)) {
        index += dollarQuote.length - 1;
        dollarQuote = null;
      }
      continue;
    }
    if (quote) {
      const closing = quote === "]" ? "]" : quote;
      if (char === "\\" && quote !== "]") {
        index++;
      } else if (char === closing) {
        if (next === closing) index++;
        else quote = null;
      }
      continue;
    }

    const dashStartsComment =
      !options.mysqlComments ||
      rawSql[index + 2] === undefined ||
      /\s/.test(rawSql[index + 2] ?? "");
    if (char === "-" && next === "-" && dashStartsComment) {
      lineComment = true;
      syntax += " ";
      index++;
      continue;
    }
    if (options.mysqlComments && char === "#") {
      lineComment = true;
      syntax += " ";
      continue;
    }
    if (char === "/" && next === "*") {
      if (rawSql[index + 2] === "!") {
        hasExecutableMysqlComment = true;
        hasCode = true;
      }
      blockDepth = 1;
      syntax += " ";
      index++;
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      hasCode = true;
      syntax += " ";
      continue;
    }
    if (char === "[") {
      quote = "]";
      hasCode = true;
      syntax += " ";
      continue;
    }
    if (options.dollarQuotes && char === "$") {
      const tag = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(rawSql.slice(index))?.[0];
      if (tag) {
        dollarQuote = tag;
        hasDollarQuote = true;
        hasCode = true;
        syntax += " ";
        index += tag.length - 1;
        continue;
      }
    }
    if (char === ";") {
      finishStatement(index);
      continue;
    }
    if (!/\s/.test(char ?? "")) hasCode = true;
    syntax += char;
  }

  if (quote || dollarQuote || blockDepth > 0) {
    throw new MigrationSqlLexError("unterminated-quote-or-comment");
  }
  if (hasCode) finishStatement(rawSql.length);
  return statements;
}
