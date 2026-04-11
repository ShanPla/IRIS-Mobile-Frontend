import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
    padding: 20,
    paddingTop: 56,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  desc: {
    color: "#64748b",
    fontSize: 13,
    marginBottom: 20,
  },
  error: {
    color: "#dc2626",
    fontSize: 13,
  },
  feedWrapper: {
    flex: 1,
    gap: 16,
  },
  feed: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  refreshBtn: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  refreshBtnText: {
    color: "#2563eb",
    fontWeight: "600",
    fontSize: 14,
  },
  note: {
    color: "#64748b",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
});