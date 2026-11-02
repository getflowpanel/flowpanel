"use client";
import { useLabels } from "@flowpanel/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

/** `push` makes a history entry Back can undo; `replace` does not, for search as it is typed. */
export type ListHistory = "push" | "replace";

export interface ListNavigation {
  /** A change was sent and the server has not answered with the new rows yet. */
  pending: boolean;
  /** The list's query as the reader last set it, ahead of the URL while a change is pending. */
  params: URLSearchParams;
  /** Edit the list's query, then load it in a transition so the old rows stay until the new ones arrive. */
  navigate: (
    edit: (params: URLSearchParams) => void,
    history: ListHistory,
    options?: { scroll?: boolean },
  ) => void;
}

const ListNavigationContext = React.createContext<ListNavigation | null>(null);

function useNavigation(): ListNavigation {
  const router = useRouter();
  const pathname = usePathname();
  const current = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [target, setTarget] = React.useState<string | null>(null);
  const params = React.useMemo(
    () => (pending && target !== null ? new URLSearchParams(target) : current),
    [pending, target, current],
  );
  const navigate = React.useCallback<ListNavigation["navigate"]>(
    (edit, history, options) => {
      const next = new URLSearchParams(params.toString());
      edit(next);
      const query = next.toString();
      const href = query ? `${pathname}?${query}` : pathname;
      const scroll = options?.scroll ?? false;
      setTarget(query);
      startTransition(() => {
        if (history === "push") router.push(href, { scroll });
        else router.replace(href, { scroll });
      });
    },
    [router, pathname, params],
  );
  return React.useMemo(() => ({ pending, params, navigate }), [pending, params, navigate]);
}

/** One transition for a list's search, filters, sort and pages, so the list can say it is loading. */
export function ListNavigationProvider({ children }: { children: React.ReactNode }) {
  const navigation = useNavigation();
  const { table } = useLabels();
  return (
    <ListNavigationContext.Provider value={navigation}>
      <div data-fp-list="" aria-busy={navigation.pending || undefined} className="fp-relative">
        {navigation.pending ? (
          <span role="status" className="fp-sr-only">
            {table.loading}
          </span>
        ) : null}
        {children}
      </div>
    </ListNavigationContext.Provider>
  );
}

/** The list's shared navigation, or this component's own outside a list. */
export function useListNavigation(): ListNavigation {
  const own = useNavigation();
  return React.useContext(ListNavigationContext) ?? own;
}
