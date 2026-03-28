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
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#e5e7eb",
  },
  addBtn: {
    backgroundColor: "#22d3ee",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 13,
  },
  content: {
    padding: 20,
  },
  userList: {
    backgroundColor: "#111827",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
    marginBottom: 20,
    overflow: "hidden",
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
    gap: 12,
  },
  userRowSelected: {
    backgroundColor: "#1e3a5f",
  },
  userRowLast: {
    borderBottomWidth: 0,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#374151",
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarText: {
    color: "#9ca3af",
    fontSize: 18,
  },
  userName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#e5e7eb",
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  selectedSection: {
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#1f2937",
    gap: 16,
  },
  selectedLabel: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 4,
  },
  selectedUser: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  selectedUserName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#e5e7eb",
    flex: 1,
  },
  permissionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#374151",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: "#22d3ee",
    borderColor: "#22d3ee",
  },
  permissionLabel: {
    fontSize: 14,
    color: "#e5e7eb",
  },
  saveBtn: {
    backgroundColor: "#22d3ee",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 4,
  },
  saveBtnText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 15,
  },
  legend: {
    flexDirection: "row",
    gap: 16,
    marginTop: 16,
    justifyContent: "center",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendText: {
    color: "#6b7280",
    fontSize: 12,
  },
  empty: {
    color: "#6b7280",
    textAlign: "center",
    marginTop: 40,
    fontSize: 14,
  },
  error: {
    color: "#f87171",
    fontSize: 13,
    marginBottom: 12,
  },
});