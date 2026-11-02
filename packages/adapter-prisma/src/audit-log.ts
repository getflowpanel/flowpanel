import type { AuditLogStore } from "@flowpanel/core";
import {
  type AuditSqlExecutor,
  type AuditSqlStatement,
  sqlAuditLog,
} from "@flowpanel/core/internal";
import type { PrismaClientLike } from "./runtime";
import type { PrismaProvider } from "./sql-statements";

function template({ strings }: AuditSqlStatement): TemplateStringsArray {
  return Object.assign([...strings], { raw: [...strings] });
}

function auditExecutor(prisma: PrismaClientLike): AuditSqlExecutor {
  const executor: AuditSqlExecutor = {
    run: async (statement) => {
      await prisma.$executeRaw(template(statement), ...statement.values);
    },
    rows: (statement) =>
      prisma.$queryRaw<Array<Record<string, unknown>>>(template(statement), ...statement.values),
  };
  if (prisma.$transaction) {
    const begin = prisma.$transaction.bind(prisma);
    executor.transaction = <T>(run: (tx: AuditSqlExecutor) => Promise<T>): Promise<T> =>
      begin((tx) => run(auditExecutor(tx)));
  }
  return executor;
}

/** `flowpanel_audit_log` through `$executeRaw` and `$queryRaw`, so every value stays a bound parameter. */
export function prismaAuditLog(prisma: PrismaClientLike, provider: PrismaProvider): AuditLogStore {
  return sqlAuditLog(provider, auditExecutor(prisma));
}
