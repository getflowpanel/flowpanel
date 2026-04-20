"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../utils/cn";

export function ResourcePagination({
  page,
  totalPages,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1 && total === 0) return null;

  const start = Math.min((page - 1) * pageSize + 1, total);
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between px-2 py-3 text-sm text-muted-foreground">
      <span>
        {total > 0 ? (
          <>
            Showing{" "}
            <span className="font-medium text-foreground">
              {start}–{end}
            </span>{" "}
            of <span className="font-medium text-foreground">{total.toLocaleString()}</span>
          </>
        ) : (
          "No results"
        )}
      </span>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className={cn("px-3 py-1 text-sm")}>
            Page {page} of {totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
