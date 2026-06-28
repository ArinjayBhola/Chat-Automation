"use client";

import {
  CalendarDays,
  FileText,
  Mail,
  PenLine,
  type LucideIcon,
} from "lucide-react";

const SUGGESTIONS: { icon: LucideIcon; label: string; prompt: string }[] = [
  {
    icon: Mail,
    label: "Summarise unread email",
    prompt: "Summarise my unread emails and flag anything that needs a reply.",
  },
  {
    icon: CalendarDays,
    label: "My week at a glance",
    prompt: "What's on my calendar for the next 7 days?",
  },
  {
    icon: FileText,
    label: "Find a document",
    prompt: "Find my most recently edited document in Drive.",
  },
  {
    icon: PenLine,
    label: "Draft a follow-up",
    prompt: "Draft a short follow-up email to the team about today's meeting.",
  },
];

export function Suggestions({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {SUGGESTIONS.map(({ icon: Icon, label, prompt }) => (
        <button
          key={label}
          onClick={() => onPick(prompt)}
          className="group flex items-start gap-3 rounded-xl border bg-card p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"
        >
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-surface text-muted-foreground transition-colors group-hover:border-primary/20 group-hover:bg-primary/10 group-hover:text-primary">
            <Icon className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">{label}</span>
            <span className="line-clamp-2 text-xs text-muted-foreground">
              {prompt}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
