import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#030712",
  },
  scrollContent: {
    padding: 20,
    paddingTop: 56,
    paddingBottom: 32,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  logo: {
    fontSize: 22,
    fontWeight: "800",
    color: "#22d3ee",
    letterSpacing: 4,
  },
  logout: {
    color: "#6b7280",
    fontSize: 14,
  },

  // System Status Card
  statusCard: {
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
    marginBottom: 16,
  },
  statusCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  statusCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#e5e7eb",
  },
  modePill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#374151",
  },
  modePillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#22d3ee",
  },
  warningRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  warningIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#374151",
    alignItems: "center",
    justifyContent: "center",
  },
  warningInfo: {
    flex: 1,
  },
  warningCount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fbbf24",
  },
  warningCountSafe: {
    color: "#4ade80",
  },
  warningTimes: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  viewBtn: {
    backgroundColor: "#22d3ee",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  viewBtnText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 13,
  },

  // Alarm Grid
  alarmSection: {
    marginBottom: 16,
  },
  alarmSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#e5e7eb",
  },
  addNew: {
    fontSize: 13,
    color: "#22d3ee",
  },
  alarmGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  alarmCard: {
    width: "47%",
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
    alignItems: "flex-start",
  },
  alarmCardActive: {
    backgroundColor: "#1e3a5f",
    borderColor: "#22d3ee",
  },
  alarmCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 16,
  },
  alarmIcon: {
    fontSize: 28,
  },
  alarmLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#e5e7eb",
  },

  // Mode Toggle
  modeSection: {
    marginBottom: 16,
  },
  modeToggleRow: {
    flexDirection: "row",
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: "#1f2937",
    marginTop: 8,
  },
  modeToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  modeToggleBtnActive: {
    backgroundColor: "#22d3ee",
  },
  modeToggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  modeToggleTextActive: {
    color: "#000",
  },
  modeDesc: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 8,
    lineHeight: 18,
  },

  // Latest Snap
  latestSnapSection: {
    marginBottom: 16,
  },
  snapCard: {
    marginTop: 8,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1f2937",
    backgroundColor: "#111827",
  },
  snapImage: {
    width: "100%",
    height: 180,
  },
  snapPlaceholder: {
    width: "100%",
    height: 180,
    backgroundColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
  },
  snapOverlay: {
    position: "absolute",
    bottom: 12,
    right: 12,
  },
  snapViewBtn: {
    backgroundColor: "#22d3ee",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  snapViewBtnText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 13,
  },
  snapTime: {
    fontSize: 12,
    color: "#6b7280",
    padding: 10,
  },

  error: {
    color: "#f87171",
    fontSize: 13,
    marginBottom: 12,
  },
});