"use client";
import { Button } from "@flowpanel/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wall } from "./wall";

/** What the not-found page says for one resource's missing record. */
export interface MissingRecordCopy {
  title: string;
  back: string;
  href: string;
}

export interface NotFoundBodyProps {
  adminPath: string;
  title: string;
  description: string;
  back: string;
  recordDescription: string;
  /** By resource name, for the resources the reader may open. */
  records: Record<string, MissingRecordCopy>;
}

function segmentsUnder(pathname: string, adminPath: string): string[] {
  const base = adminPath === "/" ? "" : adminPath;
  if (base !== "" && pathname !== base && !pathname.startsWith(`${base}/`)) return [];
  return pathname
    .slice(base.length)
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });
}

/** `<resource>/<id>` or `<resource>/<id>/edit`: a record that was asked for by id. */
function missingRecord(
  segments: readonly string[],
  records: NotFoundBodyProps["records"],
): MissingRecordCopy | undefined {
  const [name, id, rest, ...extra] = segments;
  if (!name || !id || id === "new" || extra.length > 0) return undefined;
  if (rest !== undefined && rest !== "edit") return undefined;
  return records[name];
}

/** The not-found page's message: a record that is gone names its resource and leads back to its list. */
export function NotFoundBody(props: NotFoundBodyProps) {
  const record = missingRecord(segmentsUnder(usePathname(), props.adminPath), props.records);
  const back = record ? { label: record.back, href: record.href } : null;
  return (
    <Wall
      title={record ? record.title : props.title}
      description={record ? props.recordDescription : props.description}
      actions={
        <Button asChild variant={back ? "default" : "outline"}>
          <Link href={back ? back.href : props.adminPath} prefetch={false}>
            {back ? back.label : props.back}
          </Link>
        </Button>
      }
    />
  );
}
