"use client";
import { Button } from "../ui/button.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu.js";

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
          className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
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
