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
  desc: {
    color: "#6b7280",
    fontSize: 13,
    marginBottom: 20,
  },
  error: {
    color: "#f87171",
    fontSize: 13,
  },
  feedWrapper: {
    flex: 1,
    gap: 16,
  },
  feed: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#111827",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  refreshBtn: {
    backgroundColor: "#1f2937",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  refreshBtnText: {
    color: "#22d3ee",
    fontWeight: "600",
    fontSize: 14,
  },
  note: {
    color: "#4b5563",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
});