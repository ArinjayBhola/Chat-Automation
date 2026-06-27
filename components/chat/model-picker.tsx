"use client";

import { Cpu } from "lucide-react";
import type { ModelChoice } from "@/lib/ai/models";

const PROVIDER_LABEL: Record<string, string> = {
  anthropic: "Claude",
  openai: "OpenAI",
  google: "Gemini",
  opensource: "Open source",
};

export function ModelPicker({
  models,
  value,
  onChange,
}: {
  models: ModelChoice[];
  value: string;
  onChange: (id: string) => void;
}) {
  // Group by provider for the optgroups.
  const groups = models.reduce<Record<string, ModelChoice[]>>((acc, m) => {
    (acc[m.provider] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div className="relative">
      <Cpu className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-md border bg-background py-2 pl-8 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {Object.entries(groups).map(([provider, items]) => (
          <optgroup key={provider} label={PROVIDER_LABEL[provider] ?? provider}>
            {items.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
                {m.available ? "" : " (not configured)"}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
