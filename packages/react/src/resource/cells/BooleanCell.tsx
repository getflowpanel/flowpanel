import { Check, X } from "lucide-react";

export function BooleanCell({ value }: { value: unknown }) {
  return value ? (
    <Check className="h-4 w-4 text-green-600" />
  ) : (
    <X className="h-4 w-4 text-muted-foreground" />
  );
}
