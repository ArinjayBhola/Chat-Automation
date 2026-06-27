"use client";

import { useEffect, useRef } from "react";
import { MessageBubble } from "./message-bubble";
import { Suggestions } from "./suggestions";
import type { ApprovalField, ClientMessage } from "@/lib/types";

type Props = {
  messages: ClientMessage[];
  onApprove: (messageId: string, fields: ApprovalField[]) => void;
  onSkip: (messageId: string) => void;
  onSuggestion: (prompt: string) => void;
};

export function MessageList({
  messages,
  onApprove,
  onSkip,
  onSuggestion,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Show starter suggestions only on a fresh conversation (just the greeting).
  const showSuggestions = messages.length === 1;

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            onApprove={onApprove}
            onSkip={onSkip}
          />
        ))}

        {showSuggestions && (
          <div className="ml-11 animate-fade-in">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Try asking
            </p>
            <Suggestions onPick={onSuggestion} />
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
