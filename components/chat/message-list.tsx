"use client";

import { useEffect, useRef } from "react";
import { MessageBubble } from "./message-bubble";
import type { ApprovalField, ClientMessage } from "@/lib/types";

type Props = {
  messages: ClientMessage[];
  onApprove: (messageId: string, fields: ApprovalField[]) => void;
  onSkip: (messageId: string) => void;
};

export function MessageList({ messages, onApprove, onSkip }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
