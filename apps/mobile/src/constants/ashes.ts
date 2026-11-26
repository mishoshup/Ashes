import { Platform } from "react-native";

export const palette = {
  ink: "#0B0A09",
  card: "#14110E",
  raised: "#1B1712",
  border: "#2B251E",
  cream: "#F2EAE0",
  muted: "#A79C8E",
  dim: "#736A5E",
  ember: "#E2603A",
  emberSoft: "rgba(226, 96, 58, 0.14)",
} as const;

export const serif =
  Platform.select({
    ios: "Georgia",
    android: "serif",
    web: "Georgia, 'Times New Roman', serif",
    default: "serif",
  }) ?? "serif";

export const sans =
  Platform.select({
    ios: "System",
    android: "sans-serif",
    web: "Inter, ui-sans-serif, system-ui, sans-serif",
    default: "System",
  }) ?? "System";

export const layout = {
  maxWidth: 760,
  gutter: 24,
} as const;
