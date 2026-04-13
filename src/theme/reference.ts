import type { ViewStyle } from "react-native";

export const referenceColors = {
  background: "#f8fafc",
  text: "#0f172a",
  textMuted: "#64748b",
  textSoft: "#475569",
  primary: "#2563eb",
  primaryDark: "#334155",
  primarySoft: "#dbeafe",
  primaryBorder: "#bfdbfe",
  card: "rgba(255,255,255,0.72)",
  cardStrong: "rgba(255,255,255,0.86)",
  border: "rgba(255,255,255,0.6)",
  success: "#16a34a",
  successSoft: "#dcfce7",
  successBorder: "#bbf7d0",
  warning: "#ea580c",
  warningSoft: "#ffedd5",
  warningBorder: "#fdba74",
  danger: "#dc2626",
  dangerSoft: "#fff1f2",
  dangerBorder: "#fecaca",
  slateSoft: "#f1f5f9",
  slateBorder: "#cbd5e1",
  overlay: "rgba(15,23,42,0.6)",
};

export const referenceLiveImage =
  "https://images.unsplash.com/photo-1773767797729-f3ae24353399?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBzZWN1cml0eSUyMGNhbWVyYSUyMG5pZ2h0JTIwdmlzaW9ufGVufDF8fHx8MTc3NTc4MDkwOXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";

export const cardShadow: ViewStyle = {
  shadowColor: "#0f172a",
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.08,
  shadowRadius: 22,
  elevation: 6,
};

export const buttonShadow: ViewStyle = {
  shadowColor: "#94a3b8",
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.12,
  shadowRadius: 14,
  elevation: 5,
};

export const glassCard: ViewStyle = {
  backgroundColor: referenceColors.card,
  borderWidth: 1,
  borderColor: referenceColors.border,
  borderRadius: 24,
};
