// Theme-aware class helpers for the Mentorship Hub.
//
// The hub must look like the original prototype in light mode (white surfaces,
// blue accent) and like the investor section in dark mode (charcoal surfaces,
// emerald accent). Rather than scatter hardcoded `blue-600 dark:emerald-500`
// pairs across seven pages, every accent lives here once. Pages compose these
// constants so re-theming is a single-file change.
//
// Surfaces themselves use the app's semantic tokens (bg-background, bg-card,
// text-foreground, text-muted-foreground, border-border) which already flip
// with the global `.dark` class — see frontend/src/index.css.

/** Solid accent button (primary call-to-action). */
export const ACCENT_SOLID =
  "bg-blue-600 hover:bg-blue-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-600 dark:text-black";

/** Accent text / links. */
export const ACCENT_TEXT = "text-blue-600 hover:text-blue-700 dark:text-emerald-400 dark:hover:text-emerald-300";

/** Soft accent chip (skills, tags, highlights). */
export const ACCENT_SOFT =
  "bg-blue-50 text-blue-700 dark:bg-emerald-500/10 dark:text-emerald-400";

/** Accent progress-bar fill. */
export const ACCENT_FILL = "bg-blue-600 dark:bg-emerald-500";

/** Welcome / hero banner gradient. */
export const HERO_GRADIENT =
  "bg-gradient-to-r from-blue-600 to-purple-600 dark:from-emerald-600 dark:to-teal-700 text-white";

/** Advanced-hub hero gradient (distinct from the primary hero). */
export const HUB_GRADIENT =
  "bg-gradient-to-r from-purple-600 to-pink-600 dark:from-violet-700 dark:to-fuchsia-800 text-white";

/** Neutral outline button (cancel / secondary actions). */
export const NEUTRAL_BTN =
  "border border-border bg-transparent hover:bg-accent text-foreground transition-colors";

/** Recharts stroke/fill colors (no Tailwind here — read once at render). */
export const CHART_PRIMARY = "#3b82f6"; // blue-500
export const CHART_SECONDARY = "#8b5cf6"; // violet-500

/**
 * Status → badge classes. Theme-aware so colored status pills stay legible on
 * both light and dark surfaces.
 */
export function statusBadge(status: string): string {
  switch (status) {
    case "completed":
    case "active":
    case "accepted":
      return "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400";
    case "in-progress":
    case "processing":
      return "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-400";
    case "pending":
    case "invited":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-400";
    case "overdue":
    case "rejected":
      return "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400";
    case "vested":
      return "bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}
