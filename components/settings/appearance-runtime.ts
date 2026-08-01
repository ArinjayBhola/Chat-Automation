export type Palette = "relay" | "cool-blue" | "forest" | "rose" | "ocean" | "slate";
export type FontSize = "small" | "default" | "large";
export type Radius = "sharp" | "default" | "soft";

const palettes: Palette[] = ["relay", "cool-blue", "forest", "rose", "ocean", "slate"];
const fontSizes: FontSize[] = ["small", "default", "large"];
const radii: Radius[] = ["sharp", "default", "soft"];

export type AppearanceSettings = {
  palette: Palette;
  fontSize: FontSize;
  radius: Radius;
  reducedMotion: boolean;
};

/** Apply saved appearance before route-specific UI mounts. */
export function applyStoredAppearance(): AppearanceSettings {
  const defaults: AppearanceSettings = {
    palette: "relay",
    fontSize: "default",
    radius: "default",
    reducedMotion: false,
  };
  if (typeof window === "undefined") return defaults;

  const root = document.documentElement;
  const rawPalette = localStorage.getItem("relay:palette");
  const palette = (rawPalette === "github"
    ? "cool-blue"
    : rawPalette === "midnight"
      ? "relay"
      : rawPalette) as Palette | null;
  const fontSize = localStorage.getItem("relay:font-size") as FontSize | null;
  const radius = localStorage.getItem("relay:radius") as Radius | null;
  const reducedMotion =
    (localStorage.getItem("relay:reducedMotion") ??
      localStorage.getItem("relay:reduced-motion")) === "true";

  const settings: AppearanceSettings = {
    palette: palette && palettes.includes(palette) ? palette : defaults.palette,
    fontSize: fontSize && fontSizes.includes(fontSize) ? fontSize : defaults.fontSize,
    radius: radius && radii.includes(radius) ? radius : defaults.radius,
    reducedMotion,
  };

  root.dataset.palette = settings.palette;
  root.dataset.fontSize = settings.fontSize;
  root.dataset.radius = settings.radius;
  if (settings.reducedMotion) root.dataset.reducedMotion = "true";
  else delete root.dataset.reducedMotion;

  if (rawPalette === "github" || rawPalette === "midnight") {
    localStorage.setItem("relay:palette", settings.palette);
  }
  if (localStorage.getItem("relay:reduced-motion") !== null) {
    localStorage.setItem("relay:reducedMotion", String(settings.reducedMotion));
  }

  return settings;
}
