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
    padding: 24,
    alignItems: "center",
    gap: 24,
  },
  faceCircle: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#111827",
    borderWidth: 2,
    borderColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  faceImage: {
    width: "100%",
    height: "100%",
  },
  facePlaceholder: {
    alignItems: "center",
    gap: 8,
  },
  facePlaceholderText: {
    color: "#6b7280",
    fontSize: 13,
  },
  scanCard: {
    width: "100%",
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#1f2937",
    alignItems: "center",
    gap: 8,
  },
  scanPercent: {
    fontSize: 28,
    fontWeight: "800",
    color: "#22d3ee",
  },
  scanLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#e5e7eb",
  },
  scanDesc: {
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 20,
  },
  nameInput: {
    width: "100%",
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 10,
    padding: 14,
    color: "#fff",
    fontSize: 15,
  },
  actionBtn: {
    width: "100%",
    backgroundColor: "#22d3ee",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  actionBtnSecondary: {
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "#374151",
  },
  actionBtnText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 15,
  },
  actionBtnTextSecondary: {
    color: "#e5e7eb",
  },
  error: {
    color: "#f87171",
    fontSize: 13,
  },
  success: {
    color: "#4ade80",
    fontSize: 13,
  },
});