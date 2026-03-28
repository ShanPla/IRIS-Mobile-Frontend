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
    gap: 16,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 8,
  },
  iconText: {
    fontSize: 36,
  },
  desc: {
    color: "#6b7280",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
  label: {
    fontSize: 13,
    color: "#9ca3af",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 10,
    padding: 14,
    color: "#fff",
    fontSize: 15,
  },
  fieldGroup: {
    gap: 4,
  },
  addBtn: {
    backgroundColor: "#22d3ee",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  addBtnText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 15,
  },
  cancelBtn: {
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#374151",
  },
  cancelBtnText: {
    color: "#9ca3af",
    fontSize: 15,
  },
  error: {
    color: "#f87171",
    fontSize: 13,
    textAlign: "center",
  },
  success: {
    color: "#4ade80",
    fontSize: 13,
    textAlign: "center",
  },
});