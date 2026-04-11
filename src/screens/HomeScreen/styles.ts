import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
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
    color: "#2563eb",
    letterSpacing: 4,
  },
  logout: {
    color: "#64748b",
    fontSize: 14,
  },

  // System Status Card
  statusCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
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
    color: "#0f172a",
  },
  modePill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  modePillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2563eb",
  },
  warningRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  warningIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
  },
  warningInfo: {
    flex: 1,
  },
  warningCount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ca8a04",
  },
  warningCountSafe: {
    color: "#16a34a",
  },
  warningTimes: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  viewBtn: {
    backgroundColor: "#2563eb",
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
    color: "#0f172a",
  },
  addNew: {
    fontSize: 13,
    color: "#2563eb",
  },
  alarmGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  alarmCard: {
    width: "47%",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "flex-start",
  },
  alarmCardActive: {
    backgroundColor: "#dbeafe",
    borderColor: "#2563eb",
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
    color: "#0f172a",
  },

  // Mode Toggle
  modeSection: {
    marginBottom: 16,
  },
  modeToggleRow: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginTop: 8,
  },
  modeToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  modeToggleBtnActive: {
    backgroundColor: "#2563eb",
  },
  modeToggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
  },
  modeToggleTextActive: {
    color: "#000",
  },
  modeDesc: {
    fontSize: 12,
    color: "#64748b",
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
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  snapImage: {
    width: "100%",
    height: 180,
  },
  snapPlaceholder: {
    width: "100%",
    height: 180,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  snapOverlay: {
    position: "absolute",
    bottom: 12,
    right: 12,
  },
  snapViewBtn: {
    backgroundColor: "#2563eb",
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
    color: "#64748b",
    padding: 10,
  },

  error: {
    color: "#dc2626",
    fontSize: 13,
    marginBottom: 12,
  },
});