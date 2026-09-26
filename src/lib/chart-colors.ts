// Colors used by the dashboard's inline-styled bars/tiles. These reference
// CSS custom properties (defined in globals.css for :root and .dark) so the
// same server-rendered markup works in both themes without knowing, at
// render time, which theme the viewer has chosen.

export const STATUS_COLOR = {
  good: "var(--chart-good)",
  warning: "var(--chart-warning)",
  serious: "var(--chart-serious)",
  critical: "var(--chart-critical)",
} as const;

export const MUTED_INK = "var(--chart-muted)";
export const TRACK_BG = "var(--chart-track)";
export const CHART_INK = "var(--chart-ink)";

// Ticket status -> bar color for the status-distribution breakdown.
export const STATUS_CHART_COLOR: Record<string, string> = {
  OPEN: "var(--chart-blue)",
  IN_PROGRESS: "var(--chart-aqua)",
  PENDING_STUDENT: STATUS_COLOR.warning,
  ESCALATED: STATUS_COLOR.critical,
  RESOLVED: STATUS_COLOR.good,
  CLOSED: MUTED_INK,
  REOPENED: STATUS_COLOR.serious,
};

// Ageing bucket -> color, increasing severity with age.
export const AGEING_BUCKET_COLOR: Record<string, string> = {
  "0-1 day": STATUS_COLOR.good,
  "1-3 days": STATUS_COLOR.warning,
  "3-7 days": STATUS_COLOR.serious,
  "7+ days": STATUS_COLOR.critical,
};
