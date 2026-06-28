"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Sidebar } from "@/components/chat/sidebar";
import type { ChatListItem } from "@/components/chat/chat-history";

type SidebarUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export type AppSidebarData = {
  user: SidebarUser;
  chats: ChatListItem[];
  activeChatId?: string;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onRenameChat: (id: string, title: string) => void;
  onNewChat: () => void;
};

/**
 * Shared two-pane layout (collapsible sidebar + main column) used by both the
 * chat and settings routes so the navigation chrome stays consistent.
 *
 * `children` is a render prop receiving `toggleSidebar`, which the route's own
 * header wires to its menu button.
 */
export function AppShell({
  sidebar,
  children,
}: {
  sidebar: AppSidebarData;
  children: (api: { toggleSidebar: () => void }) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const toggleSidebar = useCallback(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 768px)").matches
    ) {
      setCollapsed((c) => !c);
    } else {
      setOpen((o) => !o);
    }
  }, []);

  return (
    <div className="relative flex h-screen overflow-hidden bg-background">
      {open && (
        <div
          className="absolute inset-0 z-10 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <Sidebar
        open={open}
        collapsed={collapsed}
        onClose={() => setOpen(false)}
        onCollapse={() => setCollapsed(true)}
        {...sidebar}
        onSelectChat={(id) => {
          setOpen(false);
          sidebar.onSelectChat(id);
        }}
        onNewChat={() => {
          setOpen(false);
          sidebar.onNewChat();
        }}
      />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {children({ toggleSidebar })}
      </main>
    </div>
  );
}
