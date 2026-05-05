"use client";
import { Button } from "../ui/button.js";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu.js";

export interface ColumnVisibilityMenuColumn {
  field: string;
  label?: string;
}

export interface ColumnVisibilityMenuProps {
  columns: ColumnVisibilityMenuColumn[];
  visibility: Record<string, boolean>;
  onChange: (visibility: Record<string, boolean>) => void;
  buttonLabel?: string;
}

export function ColumnVisibilityMenu({
  columns,
  visibility,
  onChange,
  buttonLabel = "Columns",
}: ColumnVisibilityMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={buttonLabel}>
          {buttonLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        <DropdownMenuLabel>Columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((c) => {
          const checked = visibility[c.field] ?? true;
          return (
            <DropdownMenuCheckboxItem
              key={c.field}
              checked={checked}
              onCheckedChange={(next) => onChange({ ...visibility, [c.field]: Boolean(next) })}
              onSelect={(e) => e.preventDefault()}
            >
              {c.label ?? c.field}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
