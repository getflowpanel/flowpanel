"use client";
import { Button } from "@flowpanel/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const PARAM = "deleted";

export function ResourceListDeletedToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const active = sp.get(PARAM) === "1";

  function toggle(): void {
    const next = new URLSearchParams(sp.toString());
    if (active) next.delete(PARAM);
    else next.set(PARAM, "1");
    next.delete("page");
    const q = next.toString();
    router.push(q ? `${pathname}?${q}` : pathname);
  }

  return (
    <Button
      variant={active ? "default" : "outline"}
      onClick={toggle}
      aria-pressed={active}
      className="rounded-full"
    >
      {active ? "Hide deleted" : "Show deleted"}
    </Button>
  );
}
