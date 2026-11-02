"use client";
import { Button } from "@flowpanel/react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export interface RefreshButtonProps {
  label: string;
  variant?: "default" | "outline";
  size?: "default" | "sm";
}

/** Renders the page again on the server, keeping the reader where they are. */
export function RefreshButton({
  label,
  variant = "default",
  size = "default",
}: RefreshButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant={variant}
      size={size}
      disabled={pending}
      aria-busy={pending || undefined}
      onClick={() => startTransition(() => router.refresh())}
    >
      {label}
    </Button>
  );
}
