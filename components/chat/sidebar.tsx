"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  LogOut,
  PanelLeftClose,
  Plus,
  Settings,
  Workflow,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { ChatHistory, type ChatListItem } from "./chat-history";

type SidebarUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type Props = {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  onCollapse: () => void;
  user: SidebarUser;
  chats: ChatListItem[];
  activeChatId?: string;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onNewChat: () => void;
};

function initials(name?: string | null) {
  if (!name) return "U";
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Sidebar({
  open,
  collapsed,
  onClose,
  onCollapse,
  user,
  chats,
  activeChatId,
  onSelectChat,
  onDeleteChat,
  onNewChat,
}: Props) {
  const pathname = usePathname();
  const onSettings = pathname === "/settings";

  return (
    <aside
      className={cn(
        "absolute inset-y-0 left-0 z-20 flex w-72 shrink-0 flex-col overflow-hidden border-r bg-surface transition-all duration-200 ease-out md:static",
        open ? "translate-x-0 shadow-xl md:shadow-none" : "-translate-x-full",
        collapsed
          ? "md:w-0 md:-translate-x-full md:border-r-0"
          : "md:w-72 md:translate-x-0",
      )}
    >
      {/* Brand + collapse/close */}
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
        <Button
          variant="outline"
          className="w-full justify-start gap-2 border-dashed bg-card font-medium text-foreground/90 hover:border-primary/40 hover:text-foreground"
          onClick={onNewChat}
        >
          <Plus className="h-4 w-4 text-primary" />
          New chat
        </Button>
      </div>

      {/* Scrollable middle: chat history */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4">
        <ChatHistory
          chats={chats}
          activeChatId={activeChatId}
          onSelect={onSelectChat}
          onDelete={onDeleteChat}
        />
      </div>

      {/* Footer: account + settings + sign out */}
      <div className="shrink-0 space-y-1 border-t p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
          <Avatar className="h-8 w-8 border">
            {user.image && (
              <AvatarImage src={user.image} alt={user.name ?? "User"} />
            )}
            <AvatarFallback>{initials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name ?? "User"}</p>
            <p className="truncate text-xs text-muted-foreground">
              {user.email ?? "No email"}
            </p>
          </div>
          <ThemeToggle />
        </div>

        <Button
          asChild
          variant="ghost"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
        >
          <Link href="/workflows">
            <Workflow className="h-4 w-4" />
            Workflows
          </Link>
        </Button>

        <Button
          asChild
          variant="ghost"
          className={cn(
            "w-full justify-start gap-2",
            onSettings
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Link href="/settings">
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </Button>

        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive [&_svg]:text-destructive"
          onClick={() => signOut({ callbackUrl: "/auth/signin" })}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
