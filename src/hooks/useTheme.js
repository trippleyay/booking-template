import { useEffect } from "react";

const DEFAULTS = {
  primary: "#C084FC",
  secondary: "#F3E8FF",
  accent: "#7C3AED",
  background: "#FFFFFF",
  surface: "#FAFAFA",
  text: "#1A1A1A",
  textMuted: "#6B7280",
  border: "#E5E7EB",
  borderRadius: "12px",
};

/** "#C084FC" or "#CCC" -> [192, 132, 252]. Null if unparseable. */
function hexToRgb(hex) {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!match) return null;

  let value = match[1];
  if (value.length === 3) value = [...value].map((c) => c + c).join("");

  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
}

/** Perceived brightness, 0 (black) to 1 (white). */
function luminance([r, g, b]) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export default function useTheme(config) {
  useEffect(() => {
    if (!config?.theme) return;

    const theme = config.theme;
    const root = document.documentElement;

    const set = (name, value) => root.style.setProperty(name, value);

    set("--primary", theme.primary || DEFAULTS.primary);
    set("--secondary", theme.secondary || DEFAULTS.secondary);
    set("--accent", theme.accent || DEFAULTS.accent);
    set("--background", theme.background || DEFAULTS.background);
    set("--surface", theme.surface || DEFAULTS.surface);
    set("--text", theme.text || DEFAULTS.text);
    set("--text-muted", theme.textMuted || DEFAULTS.textMuted);
    set("--border", theme.border || DEFAULTS.border);
    set("--radius", theme.borderRadius || DEFAULTS.borderRadius);

    // The floating nav is a translucent pane over whatever scrolls beneath it,
    // so its fill has to come from the theme background rather than a literal.
    const bg = hexToRgb(theme.background || DEFAULTS.background);

    if (bg) {
      set("--nav-bg", `rgba(${bg.join(", ")}, 0.92)`);
      set("--nav-bg-idle", `rgba(${bg.join(", ")}, 0.7)`);

      // Warm translucent shadows disappear on a dark palette. Deepen them so
      // cards keep their edges when a forker themes the site dark.
      const isDark = luminance(bg) < 0.5;
      const tint = isDark ? "0, 0, 0" : "16, 12, 8";
      const [a, b] = isDark ? [0.5, 0.4] : [0.05, 0.06];

      set("--shadow-sm", `0 1px 2px rgba(${tint}, ${a}), 0 1px 3px rgba(${tint}, ${b})`);
      set(
        "--shadow-md",
        `0 4px 6px -1px rgba(${tint}, ${a + 0.02}), 0 2px 4px -2px rgba(${tint}, ${b})`
      );
      set(
        "--shadow-lg",
        `0 10px 20px -4px rgba(${tint}, ${a + 0.05}), 0 4px 8px -4px rgba(${tint}, ${b})`
      );
    }

    if (theme.font?.heading) {
      set("--font-heading", `"${theme.font.heading}", Georgia, serif`);
    }
    if (theme.font?.body) {
      set("--font-body", `"${theme.font.body}", system-ui, sans-serif`);
    }

    // Google Fonts, driven from config rather than hardcoded in CSS.
    const families = [theme.font?.heading, theme.font?.body]
      .filter(Boolean)
      .map((f) => f.trim().replace(/\s+/g, "+"))
      .join("&family=");

    if (families) {
      const href = `https://fonts.googleapis.com/css2?family=${families}:wght@400;500;600;700&display=swap`;
      const existing = document.getElementById("gfonts");

      if (!existing) {
        const link = document.createElement("link");
        link.id = "gfonts";
        link.rel = "stylesheet";
        link.href = href;
        document.head.appendChild(link);
      } else if (existing.href !== href) {
        existing.href = href;
      }
    }

    if (config.name) document.title = config.name;
  }, [config]);
}
