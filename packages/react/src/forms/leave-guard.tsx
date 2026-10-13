"use client";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useLabels } from "../provider/LabelsContext";

type Dialog = typeof import("../feedback/ConfirmDialog").ConfirmDialog;

let dialogLoad: Promise<Dialog | null> | null = null;

/** The confirm dialog's chunk, or `null` when it cannot load; a failure is retried next time. */
function loadDialog(): Promise<Dialog | null> {
  dialogLoad ??= import("../feedback/ConfirmDialog").then(
    (m) => m.ConfirmDialog,
    () => {
      dialogLoad = null;
      return null;
    },
  );
  return dialogLoad;
}

type Ask = (proceed: () => void) => void;

/** Forms holding unsaved changes on this page; the newest one asks. */
const askers: Ask[] = [];

/** Runs `proceed` now, or once the reader agrees to drop a form's unsaved changes. */
export function confirmLeave(proceed: () => void): void {
  const ask = askers[askers.length - 1];
  if (ask) ask(proceed);
  else proceed();
}

function inAppDestination(event: MouseEvent): string | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  if ((anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return null;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  const here = window.location;
  if (url.pathname === here.pathname && url.search === here.search) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** While `active`, asks before a reload, a link, a drawer close or `confirmLeave` drops typed changes. */
export function useLeaveGuard(active: boolean): React.ReactNode {
  const router = useRouter();
  const { saving } = useLabels();
  const [pending, setPending] = React.useState<{ proceed: () => void; Dialog: Dialog } | null>(
    null,
  );

  React.useEffect(() => {
    if (!active) return;
    void loadDialog();
    // Without the dialog's chunk the browser's own prompt asks, so typed data is never lost silently.
    const ask: Ask = (proceed) => {
      void loadDialog().then((Dialog) => {
        if (Dialog) setPending({ proceed, Dialog });
        else if (window.confirm(`${saving.unsavedTitle}\n${saving.unsavedDescription}`)) proceed();
      });
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const onClick = (event: MouseEvent) => {
      const href = inAppDestination(event);
      if (href === null) return;
      event.preventDefault();
      event.stopPropagation();
      ask(() => router.push(href));
    };
    askers.push(ask);
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      askers.splice(askers.indexOf(ask), 1);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [active, router, saving]);

  if (pending === null) return null;
  const { Dialog, proceed } = pending;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) setPending(null);
      }}
      title={saving.unsavedTitle}
      description={saving.unsavedDescription}
      confirmLabel={saving.discard}
      cancelLabel={saving.keepEditing}
      variant="destructive"
      onConfirm={() => {
        setPending(null);
        proceed();
      }}
    />
  );
}
