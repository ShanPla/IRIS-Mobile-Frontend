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
    marginBottom: 24,
  },
  error: {
    color: "#f87171",
    fontSize: 13,
    marginBottom: 12,
  },
  profileCard: {
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#1f2937",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: "#22d3ee",
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarIcon: {
    fontSize: 40,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#e5e7eb",
  },
  profileDate: {
    fontSize: 13,
    color: "#6b7280",
  },
  noProfile: {
    color: "#6b7280",
    fontSize: 14,
    textAlign: "center",
  },
  uploadBtn: {
    backgroundColor: "#22d3ee",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    width: "100%",
  },
  uploadBtnText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 15,
  },
  deleteBtn: {
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    width: "100%",
  },
  deleteBtnText: {
    color: "#f87171",
    fontSize: 15,
  },
});