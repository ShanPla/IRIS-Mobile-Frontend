import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#030712",
  },
  header: {
    backgroundColor: "#111827",
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#e5e7eb",
  },
  content: {
    padding: 20,
    gap: 16,
  },
  snapshotCard: {
    backgroundColor: "#111827",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  snapshot: {
    width: "100%",
    height: 220,
  },
  snapshotPlaceholder: {
    width: "100%",
    height: 220,
    backgroundColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
  },
  infoCard: {
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#1f2937",
    gap: 14,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLabel: {
    fontSize: 13,
    color: "#6b7280",
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#e5e7eb",
  },
  divider: {
    height: 1,
    backgroundColor: "#1f2937",
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 13,
    fontWeight: "600",
    overflow: "hidden",
  },
  badgeAuthorized: {
    backgroundColor: "rgba(74,222,128,0.15)",
    color: "#4ade80",
  },
  badgeUnknown: {
    backgroundColor: "rgba(248,113,113,0.15)",
    color: "#f87171",
  },
  badgeUnverifiable: {
    backgroundColor: "rgba(251,191,36,0.15)",
    color: "#fbbf24",
  },
  alarmBadge: {
    backgroundColor: "rgba(248,113,113,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  alarmBadgeText: {
    color: "#f87171",
    fontSize: 13,
    fontWeight: "600",
  },
});