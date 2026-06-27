"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ToolConnections } from "./tool-connections";
import { ModelPicker } from "./model-picker";
import { ChatHistory, type ChatListItem } from "./chat-history";
import type { ModelChoice } from "@/lib/ai/models";

type SidebarUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type Props = {
  open: boolean;
  user: SidebarUser;
  models: ModelChoice[];
  modelId: string;
  onModelChange: (id: string) => void;
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
  user,
  models,
  modelId,
  onModelChange,
  chats,
  activeChatId,
  onSelectChat,
  onDeleteChat,
  onNewChat,
}: Props) {
  return (
    <aside
      className={cn(
        "absolute inset-y-0 left-0 z-20 flex w-64 shrink-0 flex-col border-r bg-card transition-transform md:static md:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}
    >
      {/* Profile */}
      <div className="border-b p-3">
        <div className="flex items-center gap-3 rounded-lg border bg-background p-2.5">
          <Avatar className="h-9 w-9">
            {user.image && <AvatarImage src={user.image} alt={user.name ?? "User"} />}
            <AvatarFallback>{initials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.name ?? "User"}</p>
            <p className="truncate text-xs text-muted-foreground">
              {user.email ?? "No email"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto scrollbar-thin p-3">
        <ChatHistory
          chats={chats}
          activeChatId={activeChatId}
          onSelect={onSelectChat}
          onDelete={onDeleteChat}
          onNew={onNewChat}
        />

        <ToolConnections />

        <div>
          <h2 className="px-1 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Model
          </h2>
          <ModelPicker models={models} value={modelId} onChange={onModelChange} />
        </div>
      </div>
    </aside>
  );
}
