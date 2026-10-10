"use client";
import { ChevronsUpDown, LogOut } from "lucide-react";
import { cn } from "../lib/cn";
import { useLabels } from "../provider/LabelsContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

export interface AccountMenuItem {
  label: string;
  href?: string;
  variant?: "default" | "destructive";
}

export interface AccountMenuUser {
  name?: string;
  email?: string;
  avatar?: string;
  items?: AccountMenuItem[];
  signOut?: string;
}

export interface AccountMenuProps {
  user: AccountMenuUser;
  align?: "start" | "end";
  className?: string;
  /**
   * Collapse to the avatar below the `sm` breakpoint. Set by the tab-strip
   * shell, where the name would otherwise eat the width the tabs scroll in.
   */
  compact?: boolean;
}

function initials(user: AccountMenuUser): string {
  const source = user.name ?? user.email ?? "?";
  return source.trim().slice(0, 1).toUpperCase();
}

function Avatar({ user }: { user: AccountMenuUser }) {
  if (user.avatar) {
    return (
      // biome-ignore lint/performance/noImgElement: next/image would pull a Next-only dep into the shared UI package
      <img
        src={user.avatar}
        alt=""
        aria-hidden="true"
        className="fp-h-6 fp-w-6 fp-rounded-full fp-object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="fp-flex fp-h-6 fp-w-6 fp-items-center fp-justify-center fp-rounded-full fp-bg-accent fp-text-[11px] fp-font-semibold fp-text-on-accent"
    >
      {initials(user)}
    </span>
  );
}

/** Account dropdown driven by `theme.user`. */
export function AccountMenu({ user, align = "start", className, compact }: AccountMenuProps) {
  const { navigation } = useLabels();
  const label = user.name ?? user.email ?? navigation.account;
  const items = user.items ?? [];
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        aria-label={navigation.accountMenu}
        className={cn(
          "fp-flex fp-min-h-11 fp-w-full fp-items-center fp-gap-2 fp-rounded-sm fp-px-2 fp-py-1.5 fp-text-left fp-text-sm fp-text-ink hover:fp-bg-canvas focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60 sm:fp-min-h-9",
          className,
        )}
      >
        <Avatar user={user} />
        <span
          className={cn("fp-min-w-0 fp-flex-1 fp-truncate", compact && "fp-hidden sm:fp-block")}
        >
          {label}
        </span>
        <ChevronsUpDown
          className={cn(
            "fp-h-3.5 fp-w-3.5 fp-shrink-0 fp-text-faint",
            compact && "fp-hidden sm:fp-block",
          )}
          aria-hidden="true"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="fp-min-w-56">
        {user.name && user.email ? (
          <>
            <div className="fp-px-2 fp-py-1.5">
              <div className="fp-truncate fp-text-sm fp-font-medium fp-text-ink">{user.name}</div>
              <div className="fp-truncate fp-text-xs fp-text-faint">{user.email}</div>
            </div>
            <DropdownMenuSeparator />
          </>
        ) : null}
        {items.map((item) => (
          <DropdownMenuItem
            key={item.label}
            asChild={item.href !== undefined}
            className={cn(
              item.variant === "destructive" &&
                "fp-text-err-ink focus:fp-bg-err/10 focus:fp-text-err-ink",
            )}
          >
            {item.href !== undefined ? (
              <a href={item.href}>{item.label}</a>
            ) : (
              <span>{item.label}</span>
            )}
          </DropdownMenuItem>
        ))}
        {user.signOut ? (
          <>
            {items.length > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem asChild>
              <a href={user.signOut}>
                <LogOut className="fp-h-4 fp-w-4" aria-hidden="true" />
                {navigation.signOut}
              </a>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
