import { cn } from "../../utils/cn";

export function TextCell({ value, mono }: { value: unknown; mono?: boolean }) {
  return (
    <span className={cn("truncate max-w-[300px] block", mono && "font-mono text-xs")}>
      {String(value)}
    </span>
  );
}
