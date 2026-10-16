"use client";
import { formatLabel } from "@flowpanel/core/labels";
import * as React from "react";
import { useLabels } from "../provider/LabelsContext";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { MobileCardList, type MobileCardListProps } from "./MobileCardList";
import { useDataTableSelection } from "./useDataTableSelection";

/** Cards a phone shows before the rest of the page folds behind one button. */
export const MOBILE_ROWS = 10;

/** The phone's card list with a select-all for the page, folded past `MOBILE_ROWS`; unfolding moves focus to the first new card. Key it by page to fold again. */
export function MobileCardFold<Row extends Record<string, unknown>>({
  rows,
  ...props
}: MobileCardListProps<Row>) {
  const labels = useLabels();
  const page = useDataTableSelection({
    rows,
    rowKey: props.rowKey,
    ...(props.selection ? { selection: props.selection } : {}),
    ...(props.onSelectionChange ? { onSelectionChange: props.onSelectionChange } : {}),
    ...(props.getRowKey ? { getRowKey: props.getRowKey } : {}),
  });
  const selectAll = React.useId();
  const [unfolded, setUnfolded] = React.useState(false);
  const focusFirstNew = React.useRef(false);
  const holder = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!unfolded || !focusFirstNew.current) return;
    focusFirstNew.current = false;
    const card = holder.current?.firstElementChild?.children[MOBILE_ROWS];
    if (!(card instanceof HTMLElement)) return;
    const control = card.querySelector<HTMLElement>("[data-fp-card-link]");
    if (!control) card.tabIndex = -1;
    (control ?? card).focus();
  }, [unfolded]);

  return (
    <>
      {page.selectionEnabled ? (
        <label
          htmlFor={selectAll}
          className="fp-mb-1 fp-flex fp-min-h-11 fp-w-fit fp-cursor-pointer fp-items-center fp-pr-3 fp-text-sm fp-text-muted"
        >
          <Checkbox
            id={selectAll}
            checked={
              page.allOnPageSelected ? true : page.someOnPageSelected ? "indeterminate" : false
            }
            onCheckedChange={page.toggleAll}
            className="fp-ml-[5px] fp-shrink-0"
          />
          {page.allOnPageSelected ? labels.table.deselectAll : labels.table.selectAll}
        </label>
      ) : null}
      <div ref={holder}>
        <MobileCardList {...props} rows={unfolded ? rows : rows.slice(0, MOBILE_ROWS)} />
        {!unfolded && rows.length > MOBILE_ROWS ? (
          <Button
            variant="ghost"
            className="fp-mt-2 fp-w-full"
            onClick={() => {
              focusFirstNew.current = true;
              setUnfolded(true);
            }}
          >
            {formatLabel(labels.widget.more, { n: rows.length - MOBILE_ROWS })}
          </Button>
        ) : null}
      </div>
    </>
  );
}
