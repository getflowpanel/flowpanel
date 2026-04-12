import * as fs from "node:fs/promises";
import * as path from "node:path";
import kleur from "kleur";

export async function runAuditExport(opts: {
  from?: string;
  to?: string;
  format?: string;
  out?: string;
}): Promise<void> {
  const cwd = process.cwd();

  // biome-ignore lint/suspicious/noExplicitAny: dynamically loaded config
  let config: any;
  try {
    config = (await import(path.join(cwd, "flowpanel.config.ts"))).flowpanel;
  } catch {
    console.error(kleur.red("Failed to load flowpanel.config.ts"));
    process.exit(1);
  }

  const db = await config.getDb();
  const params: unknown[] = [];
  const whereParts: string[] = [];

  if (opts.from) {
    whereParts.push(`at >= $${params.length + 1}`);
    params.push(new Date(opts.from));
  }
  if (opts.to) {
    whereParts.push(`at < $${params.length + 1}`);
    params.push(new Date(opts.to));
  }

  const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

  const rows = await db.execute<Record<string, unknown>>(
    `SELECT * FROM flowpanel_audit_log ${whereClause} ORDER BY at DESC`,
    params,
  );

  const format = opts.format ?? "csv";
  let output: string;

  if (format === "ndjson") {
    output = rows.map((r) => JSON.stringify(r)).join("\n");
  } else {
    if (rows.length === 0) {
      output = "No audit log entries found.\n";
    } else {
      const headers = Object.keys(rows[0]!).filter((k) => k !== "details");
      const detailKeys = new Set<string>();
      for (const row of rows) {
        const details = row.details as Record<string, unknown> | null;
        if (details) Object.keys(details).forEach((k) => detailKeys.add(`details.${k}`));
      }
      const allHeaders = [...headers, ...detailKeys];
      const csvRows = rows.map((row) => {
        const values = headers.map((h) => csvEscape(String(row[h] ?? "")));
        const detailValues = [...detailKeys].map((k) => {
          const key = k.replace("details.", "");
          // biome-ignore lint/suspicious/noExplicitAny: dynamically loaded config
          const details = row.details as any;
          return csvEscape(String(details?.[key] ?? ""));
        });
        return [...values, ...detailValues].join(",");
      });
      output = [allHeaders.join(","), ...csvRows].join("\n");
    }
  }

  if (opts.out) {
    await fs.writeFile(opts.out, output, "utf8");
    console.log(kleur.green(`  ✓ Exported ${rows.length} records to ${opts.out}`));
  } else {
    process.stdout.write(`${output}\n`);
  }
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
