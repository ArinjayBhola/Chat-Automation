"use client";

import { useMemo, useState, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { groupChats, type ChatListItem } from "@/lib/chat-groups";
import { ChatHistory } from "./chat-history";
import type { ChatActions } from "./chat-item";
import { SidebarSearch } from "./sidebar-search";
import { SidebarSkeleton } from "./sidebar-skeleton";
import { ProfileMenu, initials } from "./profile-menu";

type SidebarUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type Props = {
  open: boolean;
  collapsed: boolean;
  loading?: boolean;
  onClose: () => void;
  onCollapse: () => void;
  onExpand: () => void;
  user: SidebarUser;
  chats: ChatListItem[];
  activeChatId?: string;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onRenameChat: (id: string, title: string) => void;
  onPinChat: (id: string, pinned: boolean) => void;
  onArchiveChat: (id: string) => void;
  onNewChat: () => void;
};

function RailIcon({
  label,
  onClick,
  children,
  className,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        onClick={onClick}
        aria-label={label}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

export function Sidebar({
  open,
  collapsed,
  loading,
  onClose,
  onCollapse,
  onExpand,
  user,
  chats,
  activeChatId,
  onSelectChat,
  onDeleteChat,
  onRenameChat,
  onPinChat,
  onArchiveChat,
  onNewChat,
}: Props) {
  const [query, setQuery] = useState("");

  const actions: ChatActions = useMemo(
    () => ({
      onSelect: onSelectChat,
      onRename: onRenameChat,
      onDelete: onDeleteChat,
      onArchive: onArchiveChat,
      onPin: onPinChat,
    }),
    [onSelectChat, onRenameChat, onDeleteChat, onArchiveChat, onPinChat],
  );

  const pinned = useMemo(() => groupChats(chats).pinned, [chats]);

  const fullContent = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <Logo badgeClassName="h-7 w-7" />
        <Button
          variant="ghost"
          size="icon"
          className="hidden h-8 w-8 text-muted-foreground md:inline-flex"
          aria-label="Collapse sidebar"
          onClick={onCollapse}
        >
          <PanelLeftClose className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 md:hidden"
          aria-label="Close sidebar"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-3">
        <Button className="w-full justify-start gap-2" onClick={onNewChat}>
          <Plus className="h-4 w-4" />
          New chat
        </Button>
      </div>

      <div className="px-3 pt-3">
        <SidebarSearch value={query} onChange={setQuery} />
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-overlay px-3 py-4">
        <ChatHistory
          chats={chats}
          activeChatId={activeChatId}
          query={query}
          actions={actions}
          onNewChat={onNewChat}
        />
      </div>

      <div className="shrink-0 border-t p-3">
        <ProfileMenu user={user} side="top" align="start" />
      </div>
    </div>
  );

  const railContent = (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-full flex-col items-center gap-2 py-3">
        <RailIcon label="Expand sidebar" onClick={onExpand}>
          <PanelLeftOpen className="h-4 w-4" />
        </RailIcon>
        <RailIcon
          label="New chat"
          onClick={onNewChat}
          className="bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
        </RailIcon>

        <div className="my-1 h-px w-8 bg-border" />

        <div className="flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto scrollbar-overlay">
          {pinned.map((chat) => {
            const active = chat.id === activeChatId;
            return (
              <Tooltip key={chat.id}>
                <TooltipTrigger
                  onClick={() => onSelectChat(chat.id)}
                  aria-label={chat.title}
                  className={cn(
                    "inline-flex h-9 w-9 items-center justify-center rounded-lg text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {initials(chat.title)}
                </TooltipTrigger>
                <TooltipContent side="right">{chat.title}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        <ProfileMenu user={user} compact side="right" align="end" />
      </div>
    </TooltipProvider>
  );

  return (
    <aside
      className={cn(
        "absolute inset-y-0 left-0 z-20 flex w-72 shrink-0 flex-col overflow-hidden border-r bg-surface/80 backdrop-blur-xl transition-all duration-200 ease-out md:static",
        open ? "translate-x-0 shadow-xl md:shadow-none" : "-translate-x-full",
        collapsed ? "md:w-16 md:translate-x-0" : "md:w-72 md:translate-x-0",
      )}
    >
      {loading && !collapsed ? (
        <SidebarSkeleton />
      ) : collapsed ? (
        <>
          <div className="hidden h-full w-full md:block">{railContent}</div>
          <div className="block h-full w-full md:hidden">{fullContent}</div>
        </>
      ) : (
        fullContent
      )}
    </aside>
  );
}
