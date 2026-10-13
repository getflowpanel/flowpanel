"use client";
import { Button, useLabels } from "@flowpanel/react";
import { useListNavigation } from "./list-navigation";

const PARAM = "deleted";

export function ResourceListDeletedToggle() {
  const { navigate, params: sp } = useListNavigation();
  const active = sp.get(PARAM) === "1";
  const { table } = useLabels();

  function toggle(): void {
    navigate((next) => {
      if (active) next.delete(PARAM);
      else next.set(PARAM, "1");
      next.delete("page");
    }, "push");
  }

  return (
    <Button
      variant={active ? "default" : "outline"}
      onClick={toggle}
      aria-pressed={active}
      className="fp-rounded-full"
    >
      {active ? table.hideDeleted : table.showDeleted}
    </Button>
  );
}
