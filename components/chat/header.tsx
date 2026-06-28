"use client";

import { PanelLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandBadge } from "@/components/brand/logo";

type Props = {
  title: string;
  onToggleSidebar: () => void;
  onNewChat: () => void;
};

/**
 * Slim conversation top bar for the main column. Keeps the chrome quiet:
 * a mobile sidebar toggle, the live conversation title, and a new-chat action.
 */
export function Header({ title, onToggleSidebar, onNewChat }: Props) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur sm:px-4">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Toggle sidebar"
        onClick={onToggleSidebar}
      >
        <PanelLeft className="h-4 w-4" />
      </Button>

      {/* Brand badge only shows on mobile where the sidebar is hidden. */}
      <BrandBadge className="h-7 w-7 md:hidden" />

      <h1 className="min-w-0 flex-1 truncate text-sm font-medium text-foreground/90">
        {title}
      </h1>

      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={onNewChat}
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">New chat</span>
      </Button>
    </header>
  );
}
