"use client";

import { useState } from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";
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
  const {
    messages,
    isSending,
    modelId,
    setModelId,
    send,
    resolveApproval,
    reset,
  } = useChat(defaultModelId, user.isDemo);

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
