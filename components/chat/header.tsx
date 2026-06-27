"use client";

import { signOut } from "next-auth/react";
import Image from "next/image";
import { LogOut, Menu, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";

type Props = {
  user: { name?: string | null; image?: string | null; isDemo: boolean };
  onToggleSidebar: () => void;
  onNewChat: () => void;
};

export function Header({ user, onToggleSidebar, onNewChat }: Props) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-3 sm:px-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Toggle sidebar"
          onClick={onToggleSidebar}
        >
          <Menu className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <Logo badgeClassName="h-7 w-7" />
          {user.isDemo && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
              Demo
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={onNewChat}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New chat</span>
        </Button>
        <ThemeToggle />
        <div className="ml-1 flex items-center gap-2 rounded-full border bg-background py-1 pl-1 pr-2">
          {user.image ? (
            <Image
              src={user.image}
              alt={user.name ?? "User"}
              width={24}
              height={24}
              className="h-6 w-6 rounded-full"
              unoptimized
            />
          ) : (
            <div className="h-6 w-6 rounded-full bg-muted" />
          )}
          <span className="hidden max-w-[120px] truncate text-sm sm:inline">
            {user.name ?? "User"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            aria-label="Sign out"
            onClick={() => signOut({ callbackUrl: "/auth/signin" })}
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
