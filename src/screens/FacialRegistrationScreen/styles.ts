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
    padding: 24,
    alignItems: "center",
    gap: 24,
  },
  faceCircle: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#e2e8f0",
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
    color: "#64748b",
    fontSize: 13,
  },
  scanCard: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    gap: 8,
  },
  scanPercent: {
    fontSize: 28,
    fontWeight: "800",
    color: "#2563eb",
  },
  scanLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
  },
  scanDesc: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
  },
  nameInput: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    padding: 14,
    color: "#fff",
    fontSize: 15,
  },
  actionBtn: {
    width: "100%",
    backgroundColor: "#2563eb",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  actionBtnSecondary: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  actionBtnText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 15,
  },
  actionBtnTextSecondary: {
    color: "#0f172a",
  },
  error: {
    color: "#dc2626",
    fontSize: 13,
  },
  success: {
    color: "#16a34a",
    fontSize: 13,
  },
});