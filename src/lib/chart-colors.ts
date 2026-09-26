// Validated light-mode palette (see dataviz skill: references/palette.md).
// Status roles are reserved for severity/state; categorical hues are used
// only for neutral, non-severity identities (OPEN / IN_PROGRESS).

export const STATUS_COLOR = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;

export const CATEGORICAL = {
  blue: "#2a78d6",
  orange: "#eb6834",
  aqua: "#1baf7a",
  yellow: "#eda100",
  magenta: "#e87ba4",
  green: "#008300",
  violet: "#4a3aa7",
  red: "#e34948",
} as const;

export const MUTED_INK = "#898781";
export const TRACK_BG = "#e1e0d9";

// Ticket status -> bar color for the status-distribution breakdown.
export const STATUS_CHART_COLOR: Record<string, string> = {
  OPEN: CATEGORICAL.blue,
  IN_PROGRESS: CATEGORICAL.aqua,
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
