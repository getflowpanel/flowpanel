"use client";
import { Columns3 } from "lucide-react";
import { useLabels } from "../provider/LabelsContext";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

export interface ColumnVisibilityMenuColumn {
  field: string;
  label?: string;
}

export interface ColumnVisibilityMenuProps {
  columns: ColumnVisibilityMenuColumn[];
  visibility: Record<string, boolean>;
  /** Set, each column gets a checkbox; the last shown column cannot be hidden. */
  onChange?: (visibility: Record<string, boolean>) => void;
  buttonLabel?: string;
  /** Set, the menu ends in "Reset column widths". */
  onResetWidths?: () => void;
  /** Whether any width differs from the default, which enables the reset. */
  widthsChanged?: boolean;
}

export function ColumnVisibilityMenu({
  columns,
  visibility,
  onChange,
  buttonLabel,
  onResetWidths,
  widthsChanged = false,
}: ColumnVisibilityMenuProps) {
  const { table } = useLabels();
  const label = buttonLabel ?? table.columns;
  const shown = columns.filter((c) => visibility[c.field] ?? true).length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={label}>
          <Columns3 aria-hidden className="fp-h-4 fp-w-4 fp-text-faint" />
          <span className="fp-hidden sm:fp-inline">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="fp-min-w-[180px]">
        {onChange ? (
          <>
            <DropdownMenuLabel>{table.columns}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {columns.map((c) => {
              const checked = visibility[c.field] ?? true;
              return (
                <DropdownMenuCheckboxItem
                  key={c.field}
                  checked={checked}
                  disabled={checked && shown === 1}
                  onCheckedChange={(next) => onChange({ ...visibility, [c.field]: Boolean(next) })}
                  onSelect={(e) => e.preventDefault()}
                >
                  {c.label ?? c.field}
                </DropdownMenuCheckboxItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={shown === columns.length}
              onSelect={(e) => {
                e.preventDefault();
                onChange(Object.fromEntries(columns.map((c) => [c.field, true])));
              }}
            >
              {table.showAllColumns}
            </DropdownMenuItem>
          </>
        ) : null}
        {onResetWidths ? (
          <>
            {onChange ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem disabled={!widthsChanged} onSelect={onResetWidths}>
              {table.resetWidths}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
