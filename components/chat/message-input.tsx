"use client";

import { useRef, useState } from "react";
import { SendHorizonal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX = 8000;

export function MessageInput({
  disabled,
  onSend,
}: {
  disabled: boolean;
  onSend: (text: string) => void;
}) {
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  function autosize() {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
    requestAnimationFrame(() => {
      if (taRef.current) taRef.current.style.height = "auto";
    });
  }

  return (
    <div className="border-t bg-card px-4 py-3">
      <div className="mx-auto max-w-3xl">
        <div
          className={cn(
            "flex items-end gap-2 rounded-2xl border bg-background p-2 transition-opacity",
            disabled && "opacity-60",
          )}
        >
          <textarea
            ref={taRef}
            value={value}
            disabled={disabled}
            rows={1}
            maxLength={MAX}
            placeholder="Ask me to check your emails, organize files, summarize your week..."
            onChange={(e) => {
              setValue(e.target.value);
              autosize();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            className="max-h-[200px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm focus:outline-none disabled:cursor-not-allowed"
          />
          <Button
            size="icon"
            aria-label="Send message"
            disabled={disabled || value.trim().length === 0}
            onClick={submit}
            className="rounded-xl"
          >
            <SendHorizonal className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-1 flex justify-between px-1 text-[10px] text-muted-foreground">
          <span>Enter to send · Shift+Enter for newline</span>
          <span className={cn(value.length > MAX * 0.9 && "text-destructive")}>
            {value.length}/{MAX}
          </span>
        </div>
      </div>
    </div>
  );
}
