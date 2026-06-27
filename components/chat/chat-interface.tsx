"use client";

import { useCallback, useEffect, useState } from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";
import type { ChatListItem } from "./chat-history";
import { useChat } from "@/lib/hooks/use-chat";
import type { ModelChoice } from "@/lib/ai/models";

type SessionUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  isDemo: boolean;
};

export function ChatInterface({
  user,
  models,
  defaultModelId,
}: {
  user: SessionUser;
  models: ModelChoice[];
  defaultModelId: string;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const {
    messages,
    isSending,
    modelId,
    chatId,
    setModelId,
    send,
    resolveApproval,
    reset,
    loadChat,
  } = useChat(defaultModelId, user.isDemo);

  const refreshChats = useCallback(async () => {
    if (user.isDemo) return;
    try {
      const res = await fetch("/api/chat");
      if (!res.ok) return;
      const data: { chats: ChatListItem[] } = await res.json();
      setChats(data.chats ?? []);
    } catch {
      /* ignore */
    }
  }, [user.isDemo]);

  // Load list on mount and refresh whenever a (new) chat becomes active.
  useEffect(() => {
    refreshChats();
  }, [refreshChats, chatId]);

  const handleSelectChat = useCallback(
    (id: string) => {
      loadChat(id);
      setSidebarOpen(false);
    },
    [loadChat],
  );

  const handleDeleteChat = useCallback(
    async (id: string) => {
      setChats((prev) => prev.filter((c) => c.id !== id));
      if (id === chatId) reset();
      try {
        await fetch(`/api/chat/${id}`, { method: "DELETE" });
      } finally {
        refreshChats();
      }
    },
    [chatId, reset, refreshChats],
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header
        user={user}
        onToggleSidebar={() => setSidebarOpen((o) => !o)}
        onNewChat={reset}
      />

      <div className="relative flex flex-1 overflow-hidden">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="absolute inset-0 z-10 bg-black/40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <Sidebar
          open={sidebarOpen}
          user={user}
          models={models}
          modelId={modelId}
          onModelChange={setModelId}
          chats={chats}
          activeChatId={chatId}
          onSelectChat={handleSelectChat}
          onDeleteChat={handleDeleteChat}
          onNewChat={reset}
        />

        <main className="flex min-w-0 flex-1 flex-col">
          <MessageList
            messages={messages}
            onApprove={(id, fields) => resolveApproval(id, "approved", fields)}
            onSkip={(id) => resolveApproval(id, "skipped")}
          />
          <MessageInput disabled={isSending} onSend={send} />
        </main>
      </div>
    </div>
  );
}
