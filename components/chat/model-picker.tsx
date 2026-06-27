"use client";

import { Cpu } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PROVIDER_LABEL, type ModelChoice, type ProviderId } from "@/lib/ai/models";

const PROVIDER_ORDER: ProviderId[] = [
  "anthropic",
  "openai",
  "google",
  "openrouter",
  "groq",
  "opensource",
];

export function ModelPicker({
  models,
  value,
  onChange,
}: {
  models: ModelChoice[];
  value: string;
  onChange: (id: string) => void;
}) {
  const groups = models.reduce<Record<string, ModelChoice[]>>((acc, m) => {
    (acc[m.provider] ??= []).push(m);
    return acc;
  }, {});

  const orderedProviders = PROVIDER_ORDER.filter((p) => groups[p]?.length);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <span className="flex items-center gap-2 truncate">
          <Cpu className="h-4 w-4 shrink-0 text-muted-foreground" />
          <SelectValue placeholder="Select a model" />
        </span>
      </SelectTrigger>
      <SelectContent>
        {orderedProviders.map((provider) => (
          <SelectGroup key={provider}>
            <SelectLabel>{PROVIDER_LABEL[provider]}</SelectLabel>
            {groups[provider].map((m) => (
              <SelectItem key={m.id} value={m.id} disabled={!m.available}>
                <span className="flex items-center gap-2">
                  {m.label}
                  {!m.available && (
                    <span className="text-[10px] text-muted-foreground">
                      · add key
                    </span>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
