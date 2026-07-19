"use client";

import Link from "next/link";
import { PanelLeft, Settings, SquarePen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandBadge } from "@/components/brand/logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  title: string;
  onToggleSidebar: () => void;
  onNewChat: () => void;
};

/**
 * Slim conversation top bar for the main column. Keeps the chrome quiet:
 * a sidebar toggle and the live conversation title on the left, new-chat and
 * settings actions on the right.
 */
export function Header({ title, onToggleSidebar, onNewChat }: Props) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/40 bg-background/60 px-3 backdrop-blur-xl sm:px-4">
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

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="New chat"
            onClick={onNewChat}
          >
            <SquarePen className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>New chat</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label="Settings"
            className="text-muted-foreground"
          >
            <Link href="/settings">
              <Settings className="h-4 w-4" />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Settings</TooltipContent>
      </Tooltip>
    </header>
  );
}
