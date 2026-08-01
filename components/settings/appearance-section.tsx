"use client";

import { useEffect, useState } from "react";
import { Check, Moon, Monitor, Palette, Sun, Zap } from "lucide-react";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Palette = "relay" | "cool-blue" | "forest" | "rose" | "ocean" | "slate";
type FontSize = "small" | "default" | "large";
type Radius = "sharp" | "default" | "soft";

const PALETTES: { id: Palette; label: string; description: string; color: string }[] = [
  { id: "relay", label: "Relay", description: "Warm neutral with indigo", color: "bg-indigo-500" },
  { id: "cool-blue", label: "Cool Blue", description: "Crisp blue workspace", color: "bg-[#0969da]" },
  { id: "forest", label: "Forest", description: "Calm green workspace", color: "bg-emerald-600" },
  { id: "rose", label: "Coral", description: "Warm energetic accent", color: "bg-rose-600" },
  { id: "ocean", label: "Ocean", description: "Deep cyan and blue", color: "bg-cyan-600" },
  { id: "slate", label: "Monochrome", description: "Quiet neutral contrast", color: "bg-slate-600" },
];

function setData(name: string, value: string) {
  document.documentElement.dataset[name] = value;
  localStorage.setItem(`relay:${name}`, value);
}

export function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [palette, setPalette] = useState<Palette>("relay");
  const [fontSize, setFontSize] = useState<FontSize>("default");
  const [radius, setRadius] = useState<Radius>("default");
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setMounted(true);
    const root = document.documentElement;
    const rawPalette = localStorage.getItem("relay:palette");
    const savedPalette = (rawPalette === "github" || rawPalette === "midnight" ? (rawPalette === "github" ? "cool-blue" : "relay") : rawPalette) as Palette | null;
    const savedFontSize = localStorage.getItem("relay:font-size") as FontSize | null;
    const savedRadius = localStorage.getItem("relay:radius") as Radius | null;
    const savedMotion = localStorage.getItem("relay:reduced-motion") === "true";
    if (savedPalette && PALETTES.some((p) => p.id === savedPalette)) setPalette(savedPalette);
    if (savedFontSize && ["small", "default", "large"].includes(savedFontSize)) setFontSize(savedFontSize);
    if (savedRadius && ["sharp", "default", "soft"].includes(savedRadius)) setRadius(savedRadius);
    setReducedMotion(savedMotion);
    if (savedPalette) root.dataset.palette = savedPalette;
    if (rawPalette === "github" || rawPalette === "midnight") localStorage.setItem("relay:palette", savedPalette ?? "relay");
    if (savedFontSize) root.dataset.fontSize = savedFontSize;
    if (savedRadius) root.dataset.radius = savedRadius;
    if (savedMotion) root.dataset.reducedMotion = "true";
  }, []);

  function choosePalette(value: Palette) {
    setPalette(value);
    setData("palette", value);
  }

  function chooseFontSize(value: FontSize) {
    setFontSize(value);
    setData("fontSize", value);
  }

  function chooseRadius(value: Radius) {
    setRadius(value);
    setData("radius", value);
  }

  function chooseMotion(value: boolean) {
    setReducedMotion(value);
    setData("reducedMotion", String(value));
  }

  const modes = [
    { id: "light", label: "Light", icon: Sun },
    { id: "dark", label: "Dark", icon: Moon },
    { id: "system", label: "System", icon: Monitor },
    { id: "midnight", label: "Midnight", icon: Moon },
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-muted-foreground" />
          Appearance
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Tune Relay&apos;s colors, readability, and visual feel for your workspace.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div>
            <p className="text-sm font-medium">Theme</p>
            <p className="text-xs text-muted-foreground">Choose a fixed theme or follow your device.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {modes.map(({ id, label, icon: Icon }) => {
              const selected = mounted && theme === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    if (id === "midnight") {
                      setTheme("midnight");
                    } else {
                      setTheme(id);
                    }
                  }}
                  className={cn(
                    "flex h-10 items-center justify-center gap-1.5 rounded-lg border text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected ? "border-primary bg-primary/10 text-primary" : "bg-background hover:bg-accent",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <div>
            <p className="text-sm font-medium">Color preset</p>
            <p className="text-xs text-muted-foreground">The accent is shared across navigation, actions, and charts.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {PALETTES.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={palette === item.id}
                onClick={() => choosePalette(item.id)}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  palette === item.id ? "border-primary bg-primary/5" : "hover:bg-accent",
                )}
              >
                <span className={cn("h-7 w-7 shrink-0 rounded-full", item.color)} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
                </span>
                {palette === item.id && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <OptionGroup label="Text size" description="Adjust the overall reading scale.">
            <div className="flex gap-1 rounded-lg border bg-background p-1">
              {(["small", "default", "large"] as FontSize[]).map((value) => (
                <button key={value} type="button" aria-pressed={fontSize === value} onClick={() => chooseFontSize(value)} className={cn("flex-1 rounded-md px-2 py-1.5 text-xs transition-colors", fontSize === value ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>
                  {value === "small" ? "Small" : value === "large" ? "Large" : "Default"}
                </button>
              ))}
            </div>
          </OptionGroup>
          <OptionGroup label="Corner style" description="Control the roundness of surfaces.">
            <div className="flex gap-1 rounded-lg border bg-background p-1">
              {(["sharp", "default", "soft"] as Radius[]).map((value) => (
                <button key={value} type="button" aria-pressed={radius === value} onClick={() => chooseRadius(value)} className={cn("flex-1 rounded-md px-2 py-1.5 text-xs transition-colors", radius === value ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>
                  {value[0].toUpperCase() + value.slice(1)}
                </button>
              ))}
            </div>
          </OptionGroup>
        </div>

        <button type="button" aria-pressed={reducedMotion} onClick={() => chooseMotion(!reducedMotion)} className="flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground"><Zap className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-medium">Reduce motion</span><span className="block text-xs text-muted-foreground">Use minimal transitions and animations.</span></span>
          <span className={cn("flex h-5 w-9 items-center rounded-full p-0.5 transition-colors", reducedMotion ? "bg-primary" : "bg-muted-foreground/30")}><span className={cn("h-4 w-4 rounded-full bg-background transition-transform", reducedMotion && "translate-x-4")} /></span>
        </button>
      </CardContent>
    </Card>
  );
}

function OptionGroup({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return <div className="space-y-2"><div><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{description}</p></div>{children}</div>;
}
