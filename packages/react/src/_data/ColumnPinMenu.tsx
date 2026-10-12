"use client";
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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Column options for ${field}`}
          className="fp-h-6 fp-w-6 fp-p-0 fp-opacity-50 hover:fp-opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          ⋮
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onPin("left")} disabled={currentPin === "left"}>
          Pin left
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onPin("right")} disabled={currentPin === "right"}>
          Pin right
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onPin(null)} disabled={currentPin === null}>
          Unpin
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
