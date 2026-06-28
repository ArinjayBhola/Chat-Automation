"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { BrandMark } from "@/components/brand/logo";
import { cn, formatTime } from "@/lib/utils";
import { TOOL_META } from "@/lib/types";
import type { ApprovalField, ClientMessage } from "@/lib/types";
import { StepsList } from "./steps-list";
import { ApprovalPanel } from "./approval-panel";

type Props = {
  message: ClientMessage;
  onApprove: (messageId: string, fields: ApprovalField[]) => void;
  onSkip: (messageId: string) => void;
};

export function MessageBubble({ message, onApprove, onSkip }: Props) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex animate-fade-in flex-col items-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-muted px-4 py-2.5 text-sm">
          <div className="whitespace-pre-wrap break-words leading-relaxed">
            {message.content}
          </div>
        </div>
        <p className="mt-1 px-1 text-[10px] text-muted-foreground">
          {formatTime(message.createdAt)}
        </p>
      </div>
    );
  }

  return (
    <div className="flex animate-fade-in gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-card text-primary">
        <BrandMark className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1 pt-0.5">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-sm font-semibold">Relay</span>
          {!message.thinking && (
            <span className="text-[10px] text-muted-foreground">
              {formatTime(message.createdAt)}
            </span>
          )}
        </div>

        {message.thinking && !message.content ? (
          <ThinkingDots />
        ) : (
          <AssistantText content={message.content} />
        )}

        {/* Tool chips */}
        {message.toolsUsed.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.toolsUsed.map((t) => (
              <span
                key={t}
                className="rounded-md border bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                {TOOL_META[t].name}
              </span>
            ))}
          </div>
        )}

        <StepsList steps={message.steps} />

        {message.approval && (
          <ApprovalPanel
            approval={message.approval}
            onApprove={(fields) => onApprove(message.id, fields)}
            onSkip={() => onSkip(message.id)}
          />
        )}
      </div>
    </div>
  );
}

function AssistantText({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  if (!content) return null;

  function copy() {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="group relative">
      <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
        {content}
      </div>
      <button
        onClick={copy}
        aria-label="Copy message"
        className="mt-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
      >
        {copied ? (
          <>
            <Check className="h-3 w-3 text-emerald-500" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-3 w-3" />
            Copy
          </>
        )}
      </button>
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5 py-1 text-muted-foreground">
      <span className="flex gap-1">
        {[0, 150, 300].map((d) => (
          <span
            key={d}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70"
            style={{ animationDelay: `${d}ms` }}
          />
        ))}
      </span>
    </div>
  );
}
