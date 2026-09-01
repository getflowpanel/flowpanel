import {
  MigrationSqlLexError,
  SQL_CLIENT_DIRECTIVE,
  SQL_TRANSACTION_CONTROL,
  tokenizeMigrationSql,
} from "@flowpanel/core/internal/migration-sql";

export type PrismaProvider = "mysql" | "postgresql" | "sqlite";

/**
 * Split ordinary migration SQL without treating semicolons in strings,
 * comments, identifiers, or PostgreSQL dollar-quoted bodies as separators.
 */
export function splitSqlStatements(sql: string, provider: PrismaProvider): string[] {
  let tokenized: ReturnType<typeof tokenizeMigrationSql>;
  try {
    tokenized = tokenizeMigrationSql(sql, {
      dollarQuotes: true,
      mysqlComments: provider === "mysql",
    });
  } catch (error) {
    if (error instanceof MigrationSqlLexError) {
      throw new Error("prismaAdapter: migration SQL contains an unterminated quote or comment");
    }
    throw error;
  }

  const statements: string[] = [];
  for (const statement of tokenized) {
    if (statement.hasExecutableMysqlComment) {
      if (provider === "mysql") {
        throw new Error(
          "prismaAdapter: executable MySQL comments are not supported in migration files; " +
            "use explicit SQL statements in the ORM's native migration workflow.",
        );
      }
      if (statement.syntax === "") continue;
    }
    if (SQL_CLIENT_DIRECTIVE.test(statement.syntax)) {
      throw new Error(
        "prismaAdapter: migration SQL contains a client directive, which Prisma does not interpret. " +
          "Use the provider's native migration workflow for that file.",
      );
    }
    if (statement.hasDollarQuote && provider !== "postgresql") {
      throw new Error(
        "prismaAdapter: dollar-quoted SQL is only supported for PostgreSQL; " +
          `the configured provider is ${provider}.`,
      );
    }
    const procedural =
      provider === "postgresql"
        ? /\b(?:CREATE\s+(?:OR\s+REPLACE\s+)?(?:PROCEDURE|FUNCTION)|DO)\b/i.test(
            statement.syntax,
          ) && !statement.hasDollarQuote
        : /\bCREATE\s+(?:OR\s+REPLACE\s+)?(?:TRIGGER|PROCEDURE|FUNCTION|EVENT)\b/i.test(
            statement.syntax,
          );
    if (procedural) {
      throw new Error(
        "prismaAdapter: procedural migration SQL requires a dialect-specific runner. " +
          "Move the trigger/procedure/function to your ORM migration workflow or implement a custom applyMigration.",
      );
    }
    if (SQL_TRANSACTION_CONTROL.test(statement.syntax)) {
      throw new Error(
        "prismaAdapter: migration SQL cannot contain transaction-control statements; " +
          "the adapter owns the migration boundary.",
      );
    }
    statements.push(statement.text);
  }
  return statements;
}
