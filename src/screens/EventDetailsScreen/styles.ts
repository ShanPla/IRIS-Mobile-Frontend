import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    backgroundColor: "#ffffff",
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  content: {
    padding: 20,
    gap: 16,
  },
  snapshotCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  snapshot: {
    width: "100%",
    height: 220,
  },
  snapshotPlaceholder: {
    width: "100%",
    height: 220,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  infoCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 14,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLabel: {
    fontSize: 13,
    color: "#64748b",
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#0f172a",
  },
  divider: {
    height: 1,
    backgroundColor: "#ffffff",
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
    color: "#16a34a",
  },
  badgeUnknown: {
    backgroundColor: "rgba(248,113,113,0.15)",
    color: "#dc2626",
  },
  badgeUnverifiable: {
    backgroundColor: "rgba(251,191,36,0.15)",
    color: "#ca8a04",
  },
  alarmBadge: {
    backgroundColor: "rgba(248,113,113,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  alarmBadgeText: {
    color: "#dc2626",
    fontSize: 13,
    fontWeight: "600",
  },
});