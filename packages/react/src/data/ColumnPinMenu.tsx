"use client";
import { formatLabel } from "@flowpanel/core/labels";
import { useLabels } from "../provider/LabelsContext";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

export type PinSide = "left" | "right" | null;

export interface ColumnPinMenuProps {
  field: string;
  currentPin: PinSide;
  onPin: (side: PinSide) => void;
}

export function ColumnPinMenu({ field, currentPin, onPin }: ColumnPinMenuProps) {
  const { table } = useLabels();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={formatLabel(table.columnOptions, { label: field })}
          className="fp-h-6 fp-w-6 fp-p-0 fp-opacity-50 hover:fp-opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          ⋮
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onPin("left")} disabled={currentPin === "left"}>
          {table.pinLeft}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onPin("right")} disabled={currentPin === "right"}>
          {table.pinRight}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onPin(null)} disabled={currentPin === null}>
          {table.unpin}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
