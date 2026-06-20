"use client";
import { ChevronsUpDown, LogOut } from "lucide-react";
import { cn } from "../lib/cn.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu.js";

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
        className="h-6 w-6 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-6 w-6 items-center justify-center rounded-full bg-fp-accent text-[11px] font-semibold text-fp-accent-text"
    >
      {initials(user)}
    </span>
  );
}

/** Account dropdown driven by `theme.user`. */
export function AccountMenu({ user, align = "start", className }: AccountMenuProps) {
  const label = user.name ?? user.email ?? "Account";
  const items = user.items ?? [];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className={cn(
          "flex w-full items-center gap-2 rounded-fp-sm px-2 py-1.5 text-left text-sm text-fp-text-1 hover:bg-fp-bg-2 focus:outline-none focus:ring-2 focus:ring-fp-accent",
          className,
        )}
      >
        <Avatar user={user} />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-fp-text-3" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-56">
        {user.name && user.email ? (
          <>
            <div className="px-2 py-1.5">
              <div className="truncate text-sm font-medium text-fp-text-1">{user.name}</div>
              <div className="truncate text-xs text-fp-text-3">{user.email}</div>
            </div>
            <DropdownMenuSeparator />
          </>
        ) : null}
        {items.map((item) => (
          <DropdownMenuItem
            key={item.label}
            asChild={item.href !== undefined}
            className={cn(item.variant === "destructive" && "text-fp-err focus:text-fp-err")}
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
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sign out
              </a>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
