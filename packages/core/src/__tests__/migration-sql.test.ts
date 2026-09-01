import { describe, expect, it } from "vitest";
import { MigrationSqlLexError, tokenizeMigrationSql } from "../internal/migration-sql";

describe("tokenizeMigrationSql", () => {
  it("returns protected statement text and neutral syntax metadata without applying adapter policy", () => {
    const statements = tokenizeMigrationSql(
      `-- CREATE TRIGGER in documentation only
       SELECT 'one;two';
       CREATE FUNCTION probe() RETURNS void AS $body$
       BEGIN
         PERFORM 1;
       END
       $body$ LANGUAGE plpgsql;
       /*!40101 SET @OLD_SQL_MODE=@@SQL_MODE */ SELECT 2;`,
      { dollarQuotes: true, mysqlComments: true },
    );

    expect(statements.map(({ text }) => text)).toEqual([
      "-- CREATE TRIGGER in documentation only\n       SELECT 'one;two'",
      "CREATE FUNCTION probe() RETURNS void AS $body$\n       BEGIN\n         PERFORM 1;\n       END\n       $body$ LANGUAGE plpgsql",
      "/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE */ SELECT 2",
    ]);
    expect(statements[0]).toMatchObject({
      syntax: "SELECT",
      hasDollarQuote: false,
      hasExecutableMysqlComment: false,
    });
    expect(statements[1]).toMatchObject({
      syntax: expect.stringMatching(
        /^CREATE FUNCTION probe\(\) RETURNS void AS\s+LANGUAGE plpgsql$/,
      ),
      hasDollarQuote: true,
      hasExecutableMysqlComment: false,
    });
    expect(statements[2]).toMatchObject({
      syntax: expect.stringMatching(/^\s*SELECT 2$/),
      hasDollarQuote: false,
      hasExecutableMysqlComment: true,
    });
  });

  it("uses MySQL line-comment rules only when requested", () => {
    const sql = "SELECT 1--not-a-mysql-comment; SELECT 2;";

    expect(tokenizeMigrationSql(sql).map(({ text }) => text)).toEqual([sql]);
    expect(tokenizeMigrationSql(sql, { mysqlComments: true }).map(({ text }) => text)).toEqual([
      "SELECT 1--not-a-mysql-comment",
      "SELECT 2",
    ]);
  });

  it("reports unterminated lexical constructs without adapter-specific wording", () => {
    expect(() => tokenizeMigrationSql("SELECT 'unfinished")).toThrowError(MigrationSqlLexError);
    try {
      tokenizeMigrationSql("SELECT /* unfinished");
      throw new Error("expected tokenizeMigrationSql to fail");
    } catch (error) {
      expect(error).toMatchObject({ reason: "unterminated-quote-or-comment" });
    }
  });
});
