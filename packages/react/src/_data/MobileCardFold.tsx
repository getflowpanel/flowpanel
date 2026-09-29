"use client";
import { formatLabel } from "@flowpanel/core/labels";
import * as React from "react";
import { useLabels } from "../_provider/LabelsContext";
import { Button } from "../ui/button";
import { MobileCardList, type MobileCardListProps } from "./MobileCardList";

/** Cards a phone shows before the rest of the page folds behind one button. */
export const MOBILE_ROWS = 10;

/** The phone's card list, folded past `MOBILE_ROWS`; unfolding moves focus to the first new card. */
export function MobileCardFold<Row extends Record<string, unknown>>({
  page,
  rows,
  ...props
}: MobileCardListProps<Row> & { page: number }) {
  const labels = useLabels();
  const [unfolded, setUnfolded] = React.useState(false);
  const focusFirstNew = React.useRef(false);
  const holder = React.useRef<HTMLDivElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new page starts folded again.
  React.useEffect(() => setUnfolded(false), [page]);
  React.useEffect(() => {
    if (!unfolded || !focusFirstNew.current) return;
    focusFirstNew.current = false;
    const card = holder.current?.firstElementChild?.children[MOBILE_ROWS];
    if (!(card instanceof HTMLElement)) return;
    const control = card.querySelector<HTMLElement>('[tabindex="0"]');
    if (!control) card.tabIndex = -1;
    (control ?? card).focus();
  }, [unfolded]);

  return (
    <div ref={holder}>
      <MobileCardList {...props} rows={unfolded ? rows : rows.slice(0, MOBILE_ROWS)} />
      {!unfolded && rows.length > MOBILE_ROWS ? (
        <Button
          variant="ghost"
          className="mt-2 w-full"
          onClick={() => {
            focusFirstNew.current = true;
            setUnfolded(true);
          }}
        >
          {formatLabel(labels.widget.more, { n: rows.length - MOBILE_ROWS })}
        </Button>
      ) : null}
    </div>
  );
}
