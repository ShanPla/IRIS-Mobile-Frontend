import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#030712",
    padding: 20,
    paddingTop: 56,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#e5e7eb",
    marginBottom: 4,
  },
  meta: {
    color: "#6b7280",
    fontSize: 13,
    marginBottom: 16,
  },
  error: {
    color: "#f87171",
    fontSize: 13,
    marginBottom: 12,
  },
  empty: {
    color: "#6b7280",
    fontSize: 14,
    textAlign: "center",
    marginTop: 40,
  },
  eventCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1f2937",
    gap: 12,
  },
  eventCardAlarm: {
    borderColor: "rgba(248,113,113,0.4)",
    backgroundColor: "rgba(248,113,113,0.05)",
  },
  snapshot: {
    width: 60,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#1f2937",
  },
  snapshotPlaceholder: {
    width: 60,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
  },
  snapshotIcon: {
    fontSize: 20,
  },
  eventType: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 2,
  },
  eventTime: {
    color: "#6b7280",
    fontSize: 12,
  },
  alarmTag: {
    color: "#f87171",
    fontSize: 11,
    marginTop: 4,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    paddingVertical: 16,
  },
  pageBtn: {
    backgroundColor: "#1f2937",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    color: "#e5e7eb",
    fontSize: 14,
  },
  pageInfo: {
    color: "#6b7280",
    fontSize: 14,
  },
});